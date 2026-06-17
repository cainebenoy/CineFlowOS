import os
import re
import base64
import psycopg2
from io import BytesIO
from PIL import Image
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables
load_dotenv()

# Initialize the Gemini Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 1. Define the strict Data Models expected from the LLM
class BreakdownElement(BaseModel):
    category: str  # e.g., 'Cast', 'Prop', 'Location', 'VFX'
    name: str

class SceneExtraction(BaseModel):
    scene_number: str
    setting: str       # 'INT' or 'EXT'
    time_of_day: str   # 'DAY', 'NIGHT', 'MAGIC HOUR'
    page_eighths: int
    summary: str
    elements: List[BreakdownElement]

class ScriptBreakdownResult(BaseModel):
    scenes: List[SceneExtraction]

# 2. Input Model for the API
class ParseRequest(BaseModel):
    project_id: str
    text: str # The raw script or brief text

# 3. Setup FastAPI and Database Connection
app = FastAPI(title="CineFlow AI Worker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-cineflow-domain.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Uses the same local Docker credentials
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:localpassword@localhost:5432/cineflow")

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        raise e

# 4. The Database Injection Function
def save_extraction_to_db(project_id: str, extraction: ScriptBreakdownResult):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        for scene in extraction.scenes:
            # Insert the Scene
            cursor.execute("""
                INSERT INTO scenes (project_id, scene_number, setting, time_of_day, page_eighths, summary)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id;
            """, (project_id, scene.scene_number, scene.setting, scene.time_of_day, scene.page_eighths, scene.summary))
            
            scene_id = cursor.fetchone()[0]
            
            # Insert the Elements and map them to the Scene
            for element in scene.elements:
                # Upsert the element (avoid duplicating 'Actor 1' 50 times)
                cursor.execute("""
                    INSERT INTO breakdown_elements (project_id, category, name)
                    VALUES (%s, %s, %s)
                    ON CONFLICT DO NOTHING
                    RETURNING id;
                """, (project_id, element.category, element.name))
                
                # If ON CONFLICT triggered, we need to fetch the existing ID
                if cursor.rowcount == 0:
                    cursor.execute("""
                        SELECT id FROM breakdown_elements 
                        WHERE project_id = %s AND category = %s AND name = %s;
                    """, (project_id, element.category, element.name))
                
                element_id = cursor.fetchone()[0]
                
                # Link scene and element
                cursor.execute("""
                    INSERT INTO scene_elements (scene_id, element_id)
                    VALUES (%s, %s) ON CONFLICT DO NOTHING;
                """, (scene_id, element_id))
                
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

# 5. The Live Gemini Endpoint
@app.post("/api/ai/parse-brief")
async def parse_brief(req: ParseRequest):
    try:
        # Define the strict instructions
        system_prompt = (
            "You are an elite Assistant Director. Break down the following script or client brief into distinct production scenes. "
            "CRITICAL RULES: "
            "1. Merge continuous scenes: If actions happen at the same Location and Time without narrative breaks, group them into ONE master scene (e.g., ignore 'CUT TO:' or 'INTERCUT' if they are the same physical space/time). "
            "2. Ensure scenes are numbered sequentially with integers only (1, 2, 3...) - NO letters (A, B, C...). "
            "3. Deduplicate your output: Provide EXACTLY ONE sequence of scenes. Do NOT output the same scene twice. "
            "4. For each scene, accurately extract setting (INT/EXT), time of day, page_eighths, and explicitly categorize 'Cast', 'Prop', 'Vehicle', and 'Special Equipment' in the elements list."
        )
        
        # Call Gemini and force it to use your Pydantic schema
        response = client.models.generate_content(
            model='gemini-2.5-flash', # Blazing fast and very capable for JSON formatting
            contents=[system_prompt, req.text],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ScriptBreakdownResult, # This guarantees the strict output
            ),
        )

        # Gemini returns the structured JSON as text, so we parse it back into our Pydantic model
        extraction = ScriptBreakdownResult.model_validate_json(response.text)
        
        # Inject directly into PostgreSQL using your existing function
        save_extraction_to_db(req.project_id, extraction)
        
        return {
            "status": "success", 
            "message": f"Successfully parsed {len(extraction.scenes)} scenes from the brief."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── .fountain / .txt Script Parser ───────────────────────────────────────────

class FountainScene:
    """Represents one parsed scene block extracted from a Fountain file."""
    def __init__(self, number: int, heading: str, body: str):
        self.number = number
        self.heading = heading
        self.body = body

    def to_prompt_block(self) -> str:
        return f"SCENE {self.number}:\n{self.heading}\n\n{self.body}"


# Matches any Fountain/FDX scene heading:
#   INT. LOCATION - DAY  |  EXT. PLACE - NIGHT  |  INT/EXT. SOMEWHERE - DUSK
_SCENE_HEADING_RE = re.compile(
    r'^(INT\.?/EXT\.?|EXT\.?/INT\.?|INT\.?|EXT\.?)\s+.+?-\s*.+',
    re.IGNORECASE | re.MULTILINE
)

def parse_fountain(text: str) -> list[FountainScene]:
    """
    Splits raw Fountain (or plain-text screenplay) into discrete scene blocks.
    Returns a list of FountainScene objects, one per scene heading found.
    Falls back to treating the entire text as a single scene if no headings
    are detected (handles pasted briefs / non-standard scripts gracefully).
    """
    # Find all scene heading positions
    matches = list(_SCENE_HEADING_RE.finditer(text))

    if not matches:
        # No Fountain headings found — treat entire text as one scene block
        return [FountainScene(1, "SCENE - UNSPECIFIED", text.strip())]

    scenes = []
    for i, match in enumerate(matches):
        heading = match.group(0).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        scenes.append(FountainScene(i + 1, heading, body))

    return scenes


class FountainParseRequest(BaseModel):
    project_id: str
    # Raw text content of the .fountain or .txt file (sent by Go gateway)
    script_text: str


@app.post("/api/ai/parse-fountain")
async def parse_fountain_script(req: FountainParseRequest):
    """
    Accepts the raw text of a .fountain file, parses it into discrete scenes,
    then calls Gemini once per scene to extract breakdown elements.
    This scene-by-scene approach:
    - Eliminates context-window overflow on long scripts
    - Gives Gemini perfectly structured input (no hallucination of scene numbers)
    - Allows partial saves if one scene fails without losing the entire run
    """
    scenes = parse_fountain(req.script_text)

    if not scenes:
        raise HTTPException(status_code=422, detail="No scenes could be extracted from the script.")

    # We build a synthetic ScriptBreakdownResult so we can reuse save_extraction_to_db
    all_scene_extractions = []
    failed_scenes = []

    for scene in scenes:
        try:
            scene_prompt = (
                "You are an elite Assistant Director breaking down a film script scene for production planning. "
                "Analyze the scene block below and extract structured breakdown data. "
                "RULES: "
                "1. scene_number must match the scene number provided (integer only). "
                "2. setting must be exactly 'INT' or 'EXT'. "
                "3. time_of_day: 'DAY', 'NIGHT', 'MAGIC HOUR', 'DUSK', or 'DAWN'. "
                "4. page_eighths: estimate how many eighths of a page this scene takes (1–8). "
                "5. elements: extract EVERY unique Cast member, Prop, Vehicle, Special Equipment, "
                "   or VFX note mentioned. Use exact category labels: 'Cast', 'Prop', 'Vehicle', "
                "   'Special Equipment', 'VFX'. "
                "6. summary: one sentence describing the dramatic action.\n\n"
                f"{scene.to_prompt_block()}"
            )

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[scene_prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=SceneExtraction,
                ),
            )

            extracted = SceneExtraction.model_validate_json(response.text)
            # Enforce sequential scene numbering from our parser (not Gemini's guess)
            extracted.scene_number = str(scene.number)
            all_scene_extractions.append(extracted)

        except Exception as e:
            # Log failure for this scene but continue processing remaining scenes
            failed_scenes.append({"scene": scene.number, "heading": scene.heading, "error": str(e)})
            continue

    if not all_scene_extractions:
        raise HTTPException(
            status_code=500,
            detail=f"All {len(scenes)} scenes failed to parse. Errors: {failed_scenes}"
        )

    # Persist all successfully parsed scenes using the existing DB function
    result = ScriptBreakdownResult(scenes=all_scene_extractions)
    save_extraction_to_db(req.project_id, result)

    return {
        "status": "success",
        "message": f"Parsed {len(all_scene_extractions)} of {len(scenes)} scenes successfully.",
        "scenes_parsed": len(all_scene_extractions),
        "scenes_failed": len(failed_scenes),
        "failures": failed_scenes,
    }


# ── OCR Receipt Scanner ──────────────────────────────────────────────────────

class ReceiptExtraction(BaseModel):
    vendor_name: str
    gstin: Optional[str] = None
    amount: float
    # Gemini will auto-categorize: 'Catering', 'Transport', 'Art Dept', etc.
    category: str

class ReceiptRequest(BaseModel):
    project_id: str
    # The receipt photo encoded as a base64 string (sent from Go gateway)
    image_base64: str
    mime_type: str = "image/jpeg"  # image/jpeg or image/png

@app.post("/api/ai/scan-receipt")
async def scan_receipt(req: ReceiptRequest):
    """
    Accepts a base64-encoded receipt image, sends it to Gemini 2.5 Flash
    via multimodal vision, and returns a structured ReceiptExtraction JSON.
    This endpoint is called exclusively by the Go gateway — never directly
    from the browser — keeping this service private and auth-controlled.
    """
    try:
        # Decode the base64 image into raw bytes
        image_bytes = base64.b64decode(req.image_base64)

        # Wrap in a Gemini-compatible inline data part (no file upload needed)
        image_part = types.Part.from_bytes(
            data=image_bytes,
            mime_type=req.mime_type,
        )

        system_prompt = (
            "You are a precise accounting AI for an Indian film production company. "
            "Analyze this receipt image carefully and extract: "
            "1. vendor_name: The full business/vendor name on the receipt. "
            "2. gstin: The GST Identification Number (15-character alphanumeric), or null if not present. "
            "3. amount: The final total amount paid (as a number, no currency symbols). "
            "4. category: Classify the expense into exactly one of: "
            "'Catering', 'Transport', 'Art Department', 'Camera', 'Lighting', "
            "'Location', 'Costume', 'Makeup', 'Post Production', 'Miscellaneous'. "
            "Be strictly accurate. If a value is unclear, make your best inference."
        )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[system_prompt, image_part],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ReceiptExtraction,
            ),
        )

        extraction = ReceiptExtraction.model_validate_json(response.text)

        return {
            "status": "success",
            "data": extraction.model_dump()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
