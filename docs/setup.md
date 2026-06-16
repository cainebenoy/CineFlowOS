# Setup Guide

This guide covers how to set up and run all three services for CineFlow OS locally.

## Prerequisites
- Node.js (v18+)
- Go (v1.20+)
- Python (v3.10+)
- PostgreSQL

## 1. Database Setup
Ensure PostgreSQL is running locally on port `5432`.
Create a database named `cineflow` and secure it with the credentials specified in your `.env` files (or modify them accordingly).

## 2. Go Core API
```bash
cd core-api
go mod tidy
go run cmd/main.go
```
The Go API will automatically initialize the PostgreSQL schema upon startup. It runs on port `8080`.

## 3. Python AI Worker
```bash
cd ai-worker
python -m venv venv
.\venv\Scripts\activate  # On Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Ensure you have a `.env` file in the `ai-worker` directory containing your `GEMINI_API_KEY`.

## 4. Next.js Client
```bash
cd client
npm install
npm run dev
```
The frontend runs on port `3000`. Navigate to `http://localhost:3000` to start using CineFlow OS.
