# API Reference

The core logic of CineFlow OS is driven by a RESTful Go API built on the Chi router.

## Base URL
`http://localhost:8080/api`

---

## 📂 Projects
### `POST /projects`
Creates a new project.
**Payload:** `{"name": "Project Title", "description": "..."}`
**Returns:** JSON object of the created project with a generated `id` (UUID).

### `GET /projects`
Retrieves a list of all active projects.

---

## 📜 Script Ingestion
### `POST /projects/{id}/script/upload`
Accepts a `.pdf` file via `multipart/form-data`.
**Behavior:** Proxies the file to the Python AI worker for parsing. Upon receiving the structured JSON payload, it automatically populates the `scenes`, `breakdown_elements`, and `scene_elements` tables.

---

## 🗓️ Schedule Board
### `GET /projects/{id}/schedule`
Retrieves all scenes for a project, categorized by `shoot_day`. Unscheduled scenes return `shoot_day: 0`.

### `PUT /projects/{id}/schedule`
Bulk updates the scheduling data for an array of scenes.
**Payload:** `[{"scene_id": "uuid", "shoot_day": 1, "board_order": 0}, ...]`

---

## 🎬 On-Set Logistics
### `GET /projects/{id}/callsheet`
Returns all scenes specifically scheduled for `shoot_day = 1`. Includes hierarchical data like elements required for those scenes.

### `POST /projects/{id}/distribute`
Triggers the concurrent WhatsApp Distribution Engine.
**Behavior:** Instantly returns a `200 OK` and fires off non-blocking Goroutines to mock-distribute the call sheet data.

### `GET /projects/{id}/takes`
Retrieves the full continuity log of all takes recorded for the project.

### `POST /projects/{id}/takes`
Logs a new take.
**Payload:** `{"scene_id": "uuid", "take_number": 1, "lens": "50mm", "duration_seconds": 120, "is_circled": true, "supervisor_notes": ""}`
**Constraint:** Will return HTTP 500 if `(scene_id, take_number)` uniqueness is violated.

---

## 💰 Budgeting
### `GET /projects/{id}/budget`
Retrieves an aggregate of all `breakdown_elements`, returning their estimated and actual costs grouped by category.

### `PUT /projects/{id}/budget/elements/{elementId}`
Updates the financial ledger for a specific item.
**Payload:** `{"estimated_cost": 500.00, "actual_cost": 0.00}`

---

## 🎥 Post-Production
### `GET /projects/{id}/deliverables/dashboard`
Returns high-level Post-Production metrics.
**Returns:** `{"total_scenes": 45, "total_takes": 120, "circled_takes": 40, "vfx_shots": 12}`

### `GET /projects/{id}/deliverables/editor-turnover`
Dynamically streams a `.csv` file download of all circled takes, joined with scene metadata.

### `GET /projects/{id}/deliverables/vfx-pulls`
Returns a JSON array of all circled takes belonging to scenes that require Visual Effects.

---

## 🛡️ System Audit
### `GET /projects/{id}/audit`
Retrieves the top 100 immutable ledger entries recorded by the PostgreSQL `audit_financials_func` trigger.
**Returns:** Array of `{"id", "table_name", "action", "old_data", "new_data", "created_at"}`.
