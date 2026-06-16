import os
import psycopg2
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
