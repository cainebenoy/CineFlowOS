# API Reference

This document outlines the core API endpoints across the system.

## Core API (Go) - Port 8080

### Projects
- `GET /api/projects`: List all active projects.
- `POST /api/projects`: Create a new project.

### Scheduling
- `GET /api/projects/{id}/schedule`: Retrieve all scenes (scheduled and unscheduled) for the stripboard.
- `PUT /api/projects/{id}/schedule/order`: Bulk update the sort order of scenes via drag-and-drop.

### Call Sheet
- `GET /api/projects/{id}/callsheet`: Retrieve formatted breakdown data and schedule details for call sheet generation.

---

## AI Worker (Python) - Port 8000

### Script Parsing
- `POST /analyze`: Receives a JSON payload containing `project_id` and raw `script_text`. Calls Gemini to perform a narrative breakdown, then stores the resulting structured data directly into the Postgres database.
