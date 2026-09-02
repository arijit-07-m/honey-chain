# Honey Chain — Project Rules (Google Antigravity)

> Permanent instructions for any AI agent working on this repository.
> Full context: read `ANTIGRAVITY_HANDOFF.md` first (especially §11 Known Bugs).

## Project Identity

- **Honey Chain** — SIH 2026, Problem Statement 26021 (Ministry of MSME).
- Blockchain-based honey traceability + smart beekeeping: Hive → Sensor → MQTT → FastAPI → AI → PostgreSQL → Hash chain → QR → Consumer.
- Hackathon prototype. **Prioritize the working end-to-end demo over architectural complexity.** Never replace working architecture with fancier technology.

## Architecture — Locked Decisions (do NOT change)

1. Frontend: **one** Next.js 15 (App Router, TypeScript, Tailwind) project in `frontend/` for farmer + admin + consumer. Deploy: **Vercel**.
2. Backend: **FastAPI** in `backend/` (SQLAlchemy async, Pydantic). Deploy: **Render**.
3. DB: PostgreSQL on Render; SQLite fallback locally. Raw data stays off-chain.
4. "Blockchain" = SHA-256 hash chain in the `traceability_events` table (`previous_hash="GENESIS"` → HARVEST → PROCESSING → PACKAGING). Hyperledger Fabric is future scope — never add it now.
5. AI = exactly one feature: IsolationForest hive anomaly detection (`backend/app/ai/detector.py`) on temp/humidity/weight/sound, trained on synthetic data labeled as prototype/demo data.
6. MQTT broker: **`broker.emqx.io`** (public), topic `hive/{hive_id}/telemetry`. ESP32 firmware and `hive-sim/` publish the identical payload schema; the backend must not distinguish them.
7. Recharts must stay lazy-loaded via `next/dynamic` (fix for slow compiles).

## Critical Code Rules

- **MQTT handler**: DB writes must go through `run_coroutine_threadsafe(..., main_loop)` (`app/mqtt/handler.py`). Removing this breaks telemetry ingestion with async errors.
- **bcrypt pinned to 4.0.1** in `backend/requirements.txt` — passlib 1.7.4 crashes with bcrypt 5.x on Python 3.14. Do not bump.
- **`psycopg2-binary` must stay** in requirements — the sync engine in `app/database.py` needs it (missing it = startup crash).
- **Seed must stay idempotent** (`app/services/seed.py`): early-return if users already exist, or startup crashes with UniqueViolationError.
- **Route order**: `/api/batches/verify/consumer/{batch_code}` (string) must stay declared before any `/{batch_id}` int routes.
- **CORS** (`app/core/config.py` → `get_cors_origins()`): always include `http://localhost:3000`, `https://honey-chain.vercel.app`, `https://honey-chain-ten.vercel.app`, regardless of env var. Never use `*` (credentials/auth need explicit origins).
- **Frontend fetch** (`frontend/src/lib/api.ts` → `apiFetch`): keep the 25 s AbortController timeout so UI loading states can never hang. Auth token lives in `localStorage('hc_token')`.
- No secrets in frontend code or logs. Only `NEXT_PUBLIC_*` env vars in the frontend. Backend secrets (SECRET_KEY, DB URL, MQTT creds) live only in Render environment variables.
- Never commit `backend/honeychain.db`, `.env`, or `node_modules` (see `.gitignore`).

## Environment Variables

- **Vercel (Production):** `NEXT_PUBLIC_API_URL=https://honey-chain-4byl.onrender.com` — must be set BEFORE the frontend build; changes require a redeploy.
- **Render:** `DATABASE_URL` (postgresql+asyncpg://…), `DATABASE_SYNC_URL` (postgresql://…), `SECRET_KEY`, `CORS_ORIGINS`, `MQTT_ENABLED=True`, `MQTT_BROKER_URL=broker.emqx.io`.
- Local dev: `frontend/.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:8000`; `backend/.env` mirrors `.env.example` (SQLite + MQTT on).

## Demo Credentials (must always work)

- Admin: `admin@honeychain.in` / `admin123` → `/admin/dashboard`
- Farmer: `farmer01@honeychain.in` / `farmer123` → `/farmer/dashboard`
- Consumer verify is public, no login: `/verify/HC-2026-00001`.

## UX & Language Rules

- Farmer UI: mobile-first, large buttons, simple language, high contrast, no jargon.
- AI output wording: "Potential hive anomaly detected" — NEVER claim disease diagnosis, "100% pure", "organic", or "disease-free" anywhere in the UI.
- Consumer page shows only non-private batch info; clearly separates verified digital record from unverified marketing claims.
- Realistic Indian seed data (Kanpur, Lucknow, Prayagraj, Varanasi…). Never "Lorem ipsum" / "Test User" / "ABC123".
- Simulated data must be labeled ("Demo Sensor" / "Prototype Simulation") — never presented as real field measurements.

## Workflow

- Windows/PowerShell dev machine; backend venv at `backend/venv` (`.\venv\Scripts\uvicorn app.main:app --port 8000`), frontend `npm run dev` (port 3000).
- Run `npm run build` (frontend) and import/compile-check backend Python before considering work done.
- Git remote `origin = github.com/arijit-07-m/honey-chain` (branch `main`); pushes auto-deploy Render + Vercel — verify deploys are green after every push.
- Render free tier cold-starts (30–50 s) — before diagnosing "login broken", warm `/api/health` and retry; check the CORS preflight curl in HANDOFF §12.
- **First TODO: fix the truncated `POST /api/batches/harvest`** (HANDOFF §11 bug #1) — it breaks harvest → chain → QR, the core demo flow.
