# Feature Deep Dives

CineFlow OS is built as a sequential pipeline. Data ingested in the first phase cascades perfectly into the final phase.

## 1. Script Ingestion (Pre-Production)
**The Problem:** Breaking down a 120-page PDF script manually takes weeks and is prone to human error.
**The Solution:**
- Users upload a standard PDF screenplay.
- The Go API proxies the file to the Python AI Worker.
- Using Google Gemini 1.5 Pro, the system parses the unstructured text and extracts highly structured JSON containing:
  - Scene numbers, settings (INT/EXT), and time of day.
  - A summary of the action.
  - Granular breakdown elements (Cast members, Props, VFX notes, Vehicles).
- The Go API parses this JSON and bulk inserts the hierarchical data into the `scenes`, `breakdown_elements`, and `scene_elements` tables.

## 2. Schedule Board
**The Problem:** Stripping a script and scheduling it requires dynamic flexibility.
**The Solution:**
- An interactive, drag-and-drop Kanban-style board built in Next.js.
- "Unscheduled" scenes sit in a backlog.
- Users can drag them into specific "Shoot Days."
- The UI optimistic updates instantly while sending `PUT /api/projects/{id}/schedule` requests to Go to persist the `shoot_day` and `board_order`.

## 3. Call Sheets & Distribution (On-Set)
**The Problem:** Distributing logistics to a massive crew is chaotic.
**The Solution:**
- The Go API dynamically generates a "Call Sheet" view by querying all scenes scheduled for "Day 1".
- A **WhatsApp Distribution Engine** leverages Go's concurrency (`go func()`) to simulate firing off hundreds of formatted WhatsApp messages to the crew simultaneously without blocking the main server thread.

## 4. Continuity Log
**The Problem:** Script Supervisors use pen and paper on set, causing massive delays in post-production data entry.
**The Solution:**
- A high-contrast, massive-touch-target UI designed specifically for iPad usage under heavy glare.
- Supervisors can quickly select the active scene, log a take, attach the camera lens (e.g., "50mm"), add notes, and toggle the critical "Circled" (good take) status.
- Strict PostgreSQL constraints `UNIQUE (scene_id, take_number)` prevent duplicate logs.

## 5. Dynamic Budgeting
**The Problem:** Line Producers struggle to map estimated costs to actual expenses in real-time.
**The Solution:**
- The application automatically generates a ledger from the AI-extracted `breakdown_elements` (Props, Cast, etc.).
- Producers can input an `estimated_cost` and an `actual_cost`.
- The system automatically calculates variances (over/under budget).

## 6. Post-Production Deliverables
**The Problem:** Editorial and VFX teams need structured metadata, not raw logs.
**The Solution:**
- **Editor Turnover:** Go joins the `takes` and `scenes` tables (filtering for `is_circled = TRUE`) and dynamically streams a `.csv` file. This allows instant ingestion into NLEs like Premiere Pro.
- **VFX Pulls:** Using Postgres `string_agg`, the system isolates all circled takes that belong to scenes tagged with a "VFX" element, creating an instant handoff list for the VFX Supervisor.

## 7. System Audit Logs
**The Problem:** A production house must be able to track every financial variance immutably.
**The Solution:**
- A PostgreSQL PL/pgSQL function (`audit_financials_func`) is attached as a trigger to the `breakdown_elements` table.
- When an `UPDATE` occurs, if the financial fields actually change, the trigger dumps the `OLD` and `NEW` rows as JSONB payloads into an immutable `system_audit_logs` table.
- A Next.js "Activity Feed" visualizes this terminal-style log for absolute accountability.
