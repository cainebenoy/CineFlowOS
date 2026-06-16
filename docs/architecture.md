# System Architecture

CineFlow OS uses a modern, modular architecture designed for high performance and AI integration.

## 1. Client App (Next.js)
Located in `/client`.
- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS, Lucide Icons
- **Key Features**: 
  - Drag-and-drop scheduling board (Stripboard) with dynamic color-coding.
  - Call Sheet generator with automatic data population.
  - Script ingestion interface.

## 2. Core API (Go)
Located in `/core-api`.
- **Framework**: Go standard library with `go-chi/chi` for routing.
- **Database**: PostgreSQL (using `pgx`).
- **Role**: Serves as the central source of truth for the application. Handles all CRUD operations for projects, scenes, and scheduled strip orders. It executes natural numeric sorting to ensure scenes remain in order natively.

## 3. AI Worker (Python/FastAPI)
Located in `/ai-worker`.
- **Framework**: FastAPI
- **AI Integration**: Google GenAI SDK (Gemini)
- **Role**: Receives raw script text from the frontend, sends highly structured prompts to Gemini, and parses the returned JSON. It then connects directly to the PostgreSQL database to populate the `scenes`, `scene_elements`, and `breakdown_elements` tables.

## 4. Database (PostgreSQL)
- **Schema Overview**:
  - `projects`: High-level production information.
  - `scenes`: Master scene data (INT/EXT, Day/Night, Summary).
  - `scheduled_scenes`: Tracks the drag-and-drop order on the Stripboard.
  - `breakdown_elements`: Master list of characters, props, vehicles, etc.
  - `scene_elements`: Mapping table linking scenes to their required breakdown elements.
