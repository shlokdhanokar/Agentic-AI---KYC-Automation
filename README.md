<h1 align="center">Agentic KYC Automation Pipeline</h1>

<p align="center">
  A multi-agent system that verifies identity documents end to end —
  OCR, field extraction, database cross-checks and sanctions screening —
  with a live operations dashboard.
</p>

<p align="center">
  <a href="https://agentic-ai-kyc-automation.vercel.app/"><strong>Live demo →</strong></a>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white">
  <img alt="Flask" src="https://img.shields.io/badge/Flask-3-000000?logo=flask&logoColor=white">
  <img alt="Celery" src="https://img.shields.io/badge/Celery-Redis-37814A?logo=celery&logoColor=white">
  <img alt="Azure" src="https://img.shields.io/badge/Azure-Form%20Recognizer-0078D4?logo=microsoftazure&logoColor=white">
  <img alt="Groq" src="https://img.shields.io/badge/Groq-Llama%203.3%2070B-F55036">
</p>

---

## Overview

Upload a passport, driving licence and ID card and the pipeline runs each document through four cooperating agents, streaming their progress to the dashboard in real time and returning an auditable **APPROVED / REJECTED** decision.

> **Try it without credentials:** open the [live demo](https://agentic-ai-kyc-automation.vercel.app/), click **"Open the recruiter view"**, then **Run Demo**. (The backend is on a free tier and may take ~30s to wake on the first request.)

## What it does

- **Vision Agent** — stores the document in Azure Blob, runs Azure Form Recognizer OCR, classifies the document type, and extracts structured fields with Groq Llama 3.3 70B.
- **Database Agent** — cross-references the extracted identity against the customer record store.
- **Compliance Agent** — screens the applicant against the OFAC sanctions (SDN) watchlist.
- **Orchestrator Agent** — coordinates the run, synthesises the final KYC decision, and persists the outcome.

The dashboard shows the live agent console (colour-coded by agent), a per-document extraction panel, a system-architecture view, run timing, and an audit log of past applications.

## Architecture

```
                    ┌───────────────────────────┐
   Browser  ──SSE──►│  Flask API (app.py)        │
  (React SPA)       │  · REST + Server-Sent Events│
                    └─────┬───────────────┬───────┘
                          │ enqueue       │ read/write state
                          ▼               ▼
                 ┌──────────────┐   ┌───────────┐
                 │ Celery worker│◄─►│   Redis   │  ← status, logs, results
                 └──────┬───────┘   └───────────┘
                        │ per document, in sequence
      ┌─────────────────┼──────────────────────────────┐
      ▼                 ▼               ▼                ▼
  Azure Blob      Form Recognizer   Groq Llama 3.3   OFAC SDN list
  (storage)       (OCR)             (extraction)     + Excel records
```

Documents are processed **one at a time**; the agents write progress to Redis as they go, and the browser subscribes to a **Server-Sent Events** stream (`/stream-logs`) that pushes updates only when state changes — with automatic fallback to interval polling if the stream can't be established.

For a deeper tour of the code (state flow, the motion system, deployment gotchas), see [`CLAUDE.md`](./CLAUDE.md).

## Tech stack

| Layer      | Technology |
|------------|------------|
| Frontend   | React 19 (Create React App), Tailwind CSS, lucide-react |
| Backend    | Flask, Celery, Redis |
| OCR        | Azure AI Document Intelligence (Form Recognizer) |
| Extraction | Groq — Llama 3.3 70B (JSON mode) |
| Storage    | Azure Blob Storage; Redis (state); Excel (reference records) |
| Deploy     | Vercel (frontend) · Render (backend, Docker) |

## Getting started

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- A running Redis instance
- Azure Blob Storage + Form Recognizer resources, and a Groq API key

### 1. Backend

```bash
pip install -r requirements.txt
cp .env.example .env          # then fill in the values
./start.sh                    # starts the Celery worker + Flask on :5000
```

`start.sh` launches a Celery worker (`--pool=solo`) alongside Flask's threaded server. The app **will not start without `GROQ_API_KEY`**. See [`.env.example`](./.env.example) for the full list of required variables.

### 2. Frontend

```bash
npm install
npm start                     # http://localhost:3000, proxied to the API on :5000
```

### Demo login
The dashboard uses a demo-grade hardcoded login (`shlok` / `12345`) or the **recruiter view** bypass — this is a portfolio demo, not production authentication.

## Development

```bash
npm start                             # dev server with hot reload
npm run build                         # production build → build/
CI=true npx react-scripts build       # build the way CI does — lint warnings FAIL the build
npm test -- --watchAll=false          # run the test suite once
```

> **Before pushing:** run `CI=true npx react-scripts build`. Deploys build with `CI=true`, which turns every ESLint warning (unused variables, missing hook dependencies) into a hard failure. A clean `npm start` is not sufficient.

## Deployment

Pushing to `main` deploys automatically — **Vercel** rebuilds the frontend and **Render** rebuilds the backend Docker image.

⚠️ **The `Dockerfile` copies runtime assets explicitly** (each demo image, the CSVs, the Excel file). Any new file the backend reads at runtime must be added to the `Dockerfile`, or it will be missing on Render even though it's committed to git.

## Project layout

```
app.py                 Flask API + the Celery pipeline (OCR → extract → verify → screen)
database.py            Redis wrapper — document status, logs, records, alerts
start.sh               Boots the Celery worker and the Flask server
requirements.txt       Python dependencies
Dockerfile             Backend image built by Render
render.yaml            Render service definition
vercel.json            Vercel static-build config

src/App.js             The entire React dashboard (single-file SPA)
src/index.css          Design tokens, component classes, and the motion system
public/                HTML shell (Tailwind Play CDN config) + demo thumbnails

data/                  Reference data read by the backend
  DATABASE_DOCUMENTS.xlsx   Customer records the Database Agent checks against
  OFAC_SDN_LIST.csv         Sanctions watchlist the Compliance Agent screens against
assets/demo/           Sample documents served by the "Run Demo" flow
scripts/               One-off utilities (e.g. regenerating the OFAC list)
```

## License

Portfolio / demonstration project. Sample documents are synthetic.
