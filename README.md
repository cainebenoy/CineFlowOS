# CineFlow OS

CineFlow OS is an advanced AI-powered cinematic pre-production platform. It automates the ingestion of screenplays, analyzes narrative sequences using generative AI (Gemini), and magically structures production schedules, call sheets, and breakdowns.

## Project Architecture

CineFlow OS is built on a microservices-inspired architecture:

1. **Frontend (`/client`)**
   - Built with Next.js and Tailwind CSS.
   - Provides a premium, interactive user interface for script ingestion, scheduling (drag-and-drop Stripboard), and call sheet generation.

2. **Core API (`/core-api`)**
   - Built with Go (Golang) and the Chi router.
   - Handles PostgreSQL database operations, project management, schedule persistence, and sorting.

3. **AI Worker (`/ai-worker`)**
   - Built with Python and FastAPI.
   - Interfaces directly with Google's Gemini AI to parse unstructured script text into structured JSON data (Scenes, Characters, Props, Setting, Time of Day).

## Getting Started

To get the application up and running locally, please refer to the detailed guide in our documentation:
- [Setup Guide](./docs/setup.md)
- [Architecture Overview](./docs/architecture.md)
- [API Reference](./docs/api_reference.md)
