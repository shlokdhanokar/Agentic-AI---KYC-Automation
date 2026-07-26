# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An agentic KYC (Know Your Customer) automation demo: a React dashboard (`src/App.js`) driving a Flask + Celery backend (`app.py`) that runs uploaded identity documents through a multi-agent pipeline — OCR, field extraction, database cross-check, and sanctions screening.

## Commands

Frontend (Create React App, React 19):
- `npm start` — dev server on :3000, proxied to the backend on `localhost:5000` (see `proxy` in `package.json`).
- `npm run build` — production build into `build/`.
- **`CI=true npx react-scripts build`** — the real gate. CI/deploys run with `CI=true`, which turns every ESLint warning into a build **failure** (unused vars, `react-hooks/exhaustive-deps`, etc.). Run this before pushing; a clean `npm start` is not enough.
- `npm test` — Jest via react-scripts (watch mode). Single test: `npm test -- --watchAll=false --testPathPattern=App`.

Backend (Flask + Celery + Redis):
- `./start.sh` — runs a Celery worker (`--pool=solo`) in the background and then `python app.py` (Flask's threaded dev server, **not** gunicorn — this is what makes the SSE endpoint viable). Needs a reachable Redis (`REDIS_URL`) and the Azure/Groq credentials below.
- `python -m py_compile app.py` — quick syntax check without running the stack.
- The app **raises at import** if `GROQ_API_KEY` is unset, so it won't start without it.

## Deployment — every push to `main` goes live

`main` is wired to auto-deploy. A commit to `main` ships to production immediately:
- **Frontend → Vercel** (`agentic-ai-kyc-automation.vercel.app`).
- **Backend → Render**, built from `Dockerfile` (`agentic-ai-kyc-automation.onrender.com`; free tier, so ~35s cold-start after idle).

Consequences to keep in mind:
- **The `Dockerfile` copies runtime assets by directory** (`COPY data/ ./data/`, `COPY assets/ ./assets/`). New reference data or demo files dropped into `data/` or `assets/demo/` are picked up automatically, but a **new top-level file** the backend reads at runtime must be added to the `Dockerfile` explicitly, or it won't exist on Render even though it's committed. This has caused real bugs.
- Prefer branch/preview deploys for risky UI work; the live site has a recruiter-facing entry point.

## Environment / credentials

`.env` (git-ignored) holds Azure + Redis config. Notable mismatch: the code path uses **Groq** (`GROQ_API_KEY`, Llama 3.3 70B) for extraction and chat, but local `.env` only carries `GEMINI_API_KEY`. `GROQ_API_KEY` must be set in the environment (and on Render). `google-genai` in `requirements.txt` is a leftover; the active code uses Groq.

Required: `GROQ_API_KEY`, `AZURE_BLOB_CONNECTION_STRING`, `AZURE_BLOB_CONTAINER_NAME`, `AZURE_FORM_RECOGNIZER_ENDPOINT`, `AZURE_FORM_RECOGNIZER_KEY`, `REDIS_URL`.

## Backend architecture (`app.py`, `database.py`)

The pipeline is a single Celery task, `process_document_with_logs` (there is an older `process_document` kept around). Stages, each writing progress to Redis as it goes:

1. `upload_to_blob` → Azure Blob Storage (unique per-upload blob name + SAS URL).
2. `extract_ocr_text` → Azure Form Recognizer (`prebuilt-read`).
3. `determine_document_type` → keyword scoring over the OCR text → `passport` / `driving_license` / `identity_card`.
4. `extract_structured_fields` → **Groq Llama 3.3 70B** in JSON mode, with a per-doc-type field schema and retry/backoff.
5. `verify_extracted_data` → cross-references against `data/DATABASE_DOCUMENTS.xlsx` (per-doc-type sheets).
6. OFAC screening → matches the extracted name against `data/OFAC_SDN_LIST.csv`.
7. Final record saved to Redis.

`database.py` is a thin Redis wrapper — it is the **single source of state** (document status, log lines, final records, alerts). There is no SQL DB; the "database" the agent cross-references is the Excel file, and results live in Redis.

Progress is exposed two ways, sharing one payload builder (`_progress_payload`):
- `GET /process-logs/<id>` — snapshot poll.
- `GET /stream-logs/<id>` — Server-Sent Events; watches Redis server-side and pushes a frame only when the payload changes. Self-terminates on a terminal status, heart-beats, and is time-capped so a stream can't leak a thread.

Endpoints that exist but the current frontend does **not** use: `/agent-chat/<id>` (RAG Q&A over a document's OCR text via Groq), `/alerts`, `/override/<id>`. Flask also serves the built frontend via the `/<path:path>` catch-all, so the Docker image is self-hosting even though production serves the frontend from Vercel.

## Frontend architecture (`src/App.js`)

Everything lives in one file. `KYCPortal` is the root; module-level components (`AgentConsole`, `PipelineNode`, `DocVerdictOverlay`, `DocumentPreviewModal`, `ArchitectureView`, `UserManagementDashboard`, `Metric`) sit above it.

- **`AGENTS` is the single source of truth** for the four agents (Vision → Azure/Groq, Database → Redis, Compliance → OFAC, Orchestrator → Groq). It drives the Command Center pipeline strip, the Architecture tab, and the roster; `ACCENT` maps each agent to a colour reused across all three. Change agents here, not in the views.
- **Documents are processed strictly sequentially** (passport → license → idCard). A queue (`uploadQueue` / `currentDocIndex`) starts one document, subscribes to its progress, and advances on completion. `activePollingKey` is the doc in flight. Per-document state is held in keyed maps: `extractedDataMap`, `agentProgressMap`, `docTimings`. The extracted-data panel follows the doc that just **completed** (not the one starting), so results show one-by-one.
- **Progress transport is SSE-first with a polling fallback.** The effect opens an `EventSource` on `/stream-logs`; if it errors or hasn't opened within ~4s (some proxies buffer `text/event-stream`), it falls back to interval polling on `/process-logs`. `streamMode` state reflects which is live. Completion is guarded to fire exactly once regardless of transport.
- **Auth is hardcoded client-side** (`shlok` / `12345` in `App.js`) with a "recruiter view" bypass button — demo-grade, not real auth.
- `API_URL = process.env.REACT_APP_API_URL || ''` — empty in production (same-origin).

## Styling & motion — read before touching CSS or animations

- **Tailwind is loaded via the Play CDN** in `public/index.html` (runtime JIT), configured inline there. The `@import "tailwindcss"` at the top of `src/index.css` is **inert** — there is no PostCSS/CRACO wiring, so no build step processes Tailwind. Practical effect: arbitrary utilities (`text-[11px]`, `bg-[#001f3f]`) work at runtime, and dynamically-constructed class strings can resolve too, but there is a flash of unstyled content on load and the app breaks offline. `src/index.css` holds the design tokens, component classes, and keyframes.
- **`src/index.css` opens with a written motion policy — follow it.** Entrance animations (`enter-*`) play once and settle (`both` fill). Looping animations (`loop-*`) are reserved for live telemetry, are mounted only while work is actually running, derive their timing from a shared `--beat`, and at most four are ever on screen. No element carries two animations; terminal states (verified/approved) must not keep pulsing. Everything is disabled under `prefers-reduced-motion`. When adding motion, add a one-shot `enter-*`/`verdict-*` keyframe rather than an infinite loop.
