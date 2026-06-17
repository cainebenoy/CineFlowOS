# CineFlow OS

CineFlow OS is an end-to-end, enterprise-grade operating system designed for the Indian AVGC (Animation, Visual Effects, Gaming, and Comics) and film production sectors. It bridges the gap between pre-production planning, on-set execution, and post-production delivery through a unified, high-performance architecture.

## 🏗️ Architecture & Tech Stack

The platform is designed as a distributed monorepo for maximum performance, concurrency, and modularity:

*   **Client (`/client`)**: Next.js 14, React, Tailwind CSS. A highly tactile, responsive front-end designed for high-glare iPad usage on-set and dense data visualization in the production office.
*   **Core Orchestrator (`/core-api`)**: Go (Golang), Chi Router, pgx. A blazingly fast backend that handles all heavy concurrent operations, RESTful routing, and database transactions.
*   **AI Engine (`/ai-worker`)**: Python, FastAPI, Google Gemini 1.5 Pro. An isolated microservice dedicated to parsing unstructured PDFs (screenplays) and extracting highly structured JSON metadata (scenes, props, cast, VFX).
*   **Truth Layer**: PostgreSQL. A relational database hardened with PL/pgSQL triggers to maintain an immutable audit trail of all financial and destructive actions.

## 🚀 Key Pipelines

1.  **Script Ingestion (Pre-Production)**: Upload a PDF screenplay. The Python AI Worker analyzes it, breaks it down into individual scenes, and extracts all necessary elements (Cast, Props, VFX, Vehicles).
2.  **The Schedule Board**: A dynamic drag-and-drop interface mapping scenes to shoot days.
3.  **Call Sheets & Logistics**: Generates daily call sheets. Features a concurrent Go-powered WhatsApp Distribution Engine to instantly push call times to crew members' phones.
4.  **Continuity Log (On-Set)**: High-contrast touch interface for the Script Supervisor to log takes, circle the best performances, and attach lens metadata directly to the database.
5.  **Dynamic Budgeting**: Real-time financial ledger tracking estimated vs. actual costs for all extracted script elements.
6.  **Post-Production Deliverables**: Instant generation of VFX pull lists and an Editor Turnover `.csv` export, ready to be dropped into Premiere Pro or DaVinci Resolve.
7.  **System Audit Engine**: Postgres-level triggers that immutably log any variance in the budget or schedule, completely securing the application against rogue edits.

## 🛠️ Local Development Setup

### Prerequisites
*   Node.js (v20+)
*   Go (v1.21+)
*   Python (v3.10+)
*   Docker Desktop
*   Google Gemini API Key

### 1. Database (PostgreSQL via Docker)
```bash
cd infra
docker-compose up -d
```
*Note: The Go API will automatically initialize the database schema and triggers on startup.*

### 2. Core API (Go)
```bash
cd core-api
go run cmd/main.go
```
*Runs on `http://localhost:8080`*

### 3. AI Worker (Python)
```bash
cd ai-worker
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
# Set your GEMINI_API_KEY in the environment
uvicorn main:app --reload --port 8000
```
*Runs on `http://localhost:8000`*

### 4. Client (Next.js)
```bash
cd client
npm install
npm run dev
```
*Runs on `http://localhost:3000`*

## 📚 Documentation
For detailed system designs, see the `/docs` folder:
*   [System Architecture & Schema](docs/architecture.md)
*   [Feature Deep Dives](docs/features.md)
*   [API Reference](docs/api_reference.md)
