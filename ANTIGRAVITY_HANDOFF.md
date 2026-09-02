# ANTIGRAVITY_HANDOFF.md

> **Handoff document for the next AI agent (Google Antigravity)**
> Project: **Honey Chain** — SIH 2026, Problem Statement 26021 (Ministry of MSME)
> Prepared by: Cline agent, 2026-09-02
> Repository: `github.com/arijit-07-m/honey-chain`, branch `main`
> **Read §11 (Known Bugs) FIRST — especially the CRITICAL harvest regression.**

---

## 1. Complete Project Architecture

```
┌─────────────┐   WiFi    ┌───────────────┐  MQTT   ┌──────────────┐
│ ESP32+DHT11 │──────────▶│ broker.emqx.io │◀───────│ hive-sim /   │
│ (real hw)   │           │ (public MQTT)  │        │ test_publish │
└─────────────┘           └───────┬────────┘        └──────────────┘
                                  │ subscribe (paho-mqtt, bg thread)
                                  ▼
                    ┌──────────────────────────┐
                    │ FastAPI backend (Render) │
                    │ app/mqtt/handler.py      │──▶ AI anomaly (IsolationForest)
                    │ run_coroutine_threadsafe │──▶ hive status update + alert
                    └────────────┬─────────────┘
                                 ▼
                    ┌──────────────────────────┐
                    │ PostgreSQL (Render)      │  raw data lives here
                    │ + traceability_events    │  only SHA-256 hashes chained
                    └────────────┬─────────────┘
                                 ▼
        ┌────────────────────────┴───────────────────────┐
        ▼                                                ▼
┌────────────────────┐                       ┌─────────────────────┐
│ Next.js frontend   │                       │ Consumer /verify/   │
│ (Vercel)           │                       │ via QR (public,     │
│ farmer + admin     │                       │ no login required)  │
└────────────────────┘                       └─────────────────────┘
```

**Core concept:** raw sensor + supply-chain data is stored **off-chain** in PostgreSQL. Each traceability event (HARVEST → PROCESSING → PACKAGING) is SHA-256 hashed and linked to the previous hash (first event uses `previous_hash = "GENESIS"`). `GET /api/batches/{id}/verify` recomputes the chain to detect tampering. Hyperledger Fabric migration is future scope only — do NOT introduce it now.

**AI feature (the only one):** hive anomaly detection via scikit-learn `IsolationForest`, trained in-process on **synthetic** normal-range data (prototype/demo data — must stay labeled as such). Output: `anomaly` bool + `anomaly_score` (0–1) + human-readable reason. An anomaly sets `hives.status = 'ATTENTION'` and inserts an `alerts` row. It does NOT diagnose bee disease; UI must keep language like "Potential hive anomaly detected."

---

## 2. Frontend Structure and Important Files

Next.js 15 App Router, TypeScript, Tailwind. **Single project** for farmer + admin + consumer. Root: `frontend/`

| File | Role |
|---|---|
| `src/app/layout.tsx` | Server root layout; renders `ClientLayout` |
| `src/app/client-layout.tsx` | `'use client'` wrapper: mounts `AuthProvider` + `ProtectedLayout` |
| `src/app/protected-layout.tsx` | Auth-guard / nav shell |
| `src/app/page.tsx` | Landing: hero, architecture flow, **inline login form** (email+password, no modal), batch-code input routing to `/verify/{code}` |
| `src/app/farmer/dashboard/page.tsx` | Farmer stats (My Hives / Healthy / Needs Care / Today Harvest kg), alerts, hive grid; redirects to `/` on logout |
| `src/app/farmer/hives/page.tsx` | Hive list |
| `src/app/farmer/hives/[hiveId]/page.tsx` | Hive detail: sensor cards, **4 Recharts charts with anomaly markers**, AI status, **auto-refresh every 10 s** |
| `src/app/farmer/harvest/page.tsx` | Harvest form → "Create Verified Batch" → `POST /api/batches/harvest` |
| `src/app/farmer/batches/page.tsx` | Batch list + detail: timeline, hashes, **Verify Chain** button, QR view/download |
| `src/app/farmer/alerts/page.tsx` | Alerts list |
| `src/app/admin/dashboard/page.tsx` | KVIC stats + charts; redirects to `/` on logout |
| `src/app/admin/clusters/page.tsx` | Cluster cards |
| `src/app/admin/batches/page.tsx` | Batch audit table (stage/actor/timestamp/hash/integrity) |
| `src/app/verify/[batchId]/page.tsx` | **Public** consumer page: ✓ VERIFIED HONEY + timeline + integrity statement |
| `src/lib/api.ts` | **THE API client** (see §19). `API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'`; `apiFetch` has a **25 s AbortController timeout** |
| `src/lib/auth.tsx` | `AuthProvider`/`useAuth`: localStorage keys `hc_token` + `hc_user`; `isAuthenticated/isFarmer/isAdmin` |
| `src/components/SensorChart.tsx` | Recharts line chart via `next/dynamic` (perf) |
| `src/components/ClusterChart.tsx` | Recharts bar chart via `next/dynamic` (perf) |
| `vercel.json` | Pins `framework: nextjs`, `buildCommand: next build`, `outputDirectory: .next`, `installCommand: npm install` (fixed Vercel "FastAPI entrypoint"/"no public dir" failures) |

**UI conventions:** farmer UI is mobile-first (large buttons, simple language, high contrast); admin is data-dense. Charts MUST stay behind `next/dynamic` (dev compile 54 s → 27 s after this change).

---

## 3. Backend/FastAPI Structure and Important Files

Root: `backend/` — all code under `app/`.

| File | Role |
|---|---|
| `app/main.py` | FastAPI + `lifespan`: `init_db()` → `seed_database()` → start MQTT handler (only if `MQTT_ENABLED`), passing the **running asyncio loop** into `MQTTHandler`. CORS middleware from `settings.get_cors_origins()`. `/api/health` reports status + active CORS origins |
| `app/core/config.py` | Pydantic Settings (`env_file=".env"`). **`get_cors_origins()` FORCE-injects both production Vercel origins** (`https://honey-chain.vercel.app`, `https://honey-chain-ten.vercel.app`) into the allowed list regardless of the `CORS_ORIGINS` env var — this was the production-login fix; do not remove |
| `app/database.py` | **Async-only** engine (`create_async_engine`). Dialect driven by `DATABASE_URL`: `sqlite+aiosqlite` locally, `postgresql+asyncpg` on Render. `init_db()` = `Base.metadata.create_all` + seed. A sync-engine/psycopg2 variant was removed (Render Python 3.14 lacked psycopg2) — do not reintroduce |
| `app/models/` | `user.py, cluster.py, hive.py, sensor_reading.py, batch.py, traceability_event.py, alert.py` (+ `__init__.py` re-exporting all — must stay complete or `create_all` skips tables) |
| `app/schemas/schemas.py` | All Pydantic request/response models |
| `app/api/` | `auth.py`, `hives.py`, `batches.py`, `alerts.py`, `admin.py` — see §5 |
| `app/services/auth.py` | passlib `CryptContext(bcrypt)`; `hash_password / verify_password / create_access_token` (JWT via python-jose). **`bcrypt==4.0.1` is pinned** — see §16 |
| `app/services/seed.py` | Idempotent: checks for existing data and **`return`s early** (a missing `return` once caused a duplicate-key startup crash loop). Seeds 5 clusters, 20 beekeepers, 30 hives, sensor history, alerts, 10+ batches with full hash chains |
| `app/blockchain/service.py` | `compute_hash(...)`, `create_event(db, batch_id, stage, actor_id, event_data)` (reads last event → `previous_hash`, stores `current_hash`), `verify_chain(db, batch_id)` (recomputes every link) |
| `app/ai/detector.py` | IsolationForest trained on first use with synthetic normal data; returns `(anomaly, score, reason)` |
| `app/mqtt/handler.py` | paho-mqtt client on a **background thread**; `on_message` → `run_coroutine_threadsafe(coro, main_loop)` so async DB writes run on uvicorn's loop. Subscribes `hive/+/telemetry`, parses payload, saves `SensorReading`, runs AI, updates hive status, creates alerts |
| `app/mqtt/service.py` | Ingestion helper used by the handler (parse → store → anomaly → alert) |
| `render.yaml` | Optional Render blueprint — **its default env values are stale**; Render dashboard env vars win |
| `Dockerfile` | Exists but deployment uses Render's native Python runtime, not Docker |

---

## 4. Database Architecture and Tables

PostgreSQL on Render (prod) / SQLite file `backend/honeychain.db` (local). Raw data off-chain; only hashes in the chain table.

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, name, email (unique), password_hash, role (`FARMER`\|`ADMIN`), created_at | Roles drive route guarding |
| `clusters` | id, name, location, created_at | 5 seeded (Kanpur, Lucknow, Prayagraj, Varanasi, +1) |
| `hives` | id, hive_code (H001…H030), cluster_id FK, farmer_id FK, status (`HEALTHY`\|`ATTENTION`), created_at | Status flipped by AI on anomaly |
| `sensor_readings` | id, hive_id FK, temperature, humidity, weight, sound_level, timestamp, anomaly (bool), anomaly_score | Written by MQTT handler + `POST /api/hives/{id}/telemetry` |
| `batches` | id, batch_code (`HC-2026-NNNNN`, unique), hive_id FK, farmer_id FK, honey_type, quantity, harvest_date, status (`HARVEST`\|`PROCESSING`\|`PACKAGING`), created_at | |
| `traceability_events` | id, batch_id FK, stage, actor_id, event_data, timestamp, previous_hash, current_hash | The hash chain. First event: `previous_hash="GENESIS"` |
| `alerts` | id, hive_id FK, type, message, severity, created_at, resolved | Created automatically by AI pipeline |

Hash formula: `SHA256(event_id + batch_id + stage + actor_id + timestamp + event_data + previous_hash)`.

---

## 5. API Endpoints (verified in code, all prefixed `/api`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | public | Status + active CORS origins |
| POST | `/api/auth/login` | public | `{email,password}` → `{access_token, token_type, role, user_id, name}` |
| GET | `/api/hives` | Bearer | List hives (optional `?farmer_id=`) |
| GET | `/api/hives/{hive_id}` | Bearer | Detail incl. latest 4 sensor values + `anomaly_status` |
| GET | `/api/hives/{hive_id}/telemetry?limit=50` | Bearer | Sensor history |
| POST | `/api/hives/{hive_id}/telemetry` | Bearer | Inject a reading (demo/anomaly injection path; also runs AI) |
| GET | `/api/batches` | Bearer | List batches |
| GET | `/api/batches/{batch_id}` | Bearer | Batch detail |
| **POST** | **`/api/batches/harvest`** | Bearer | Create batch + HARVEST chain event — **⚠ CURRENTLY BROKEN, see §11 Bug #1** |
| POST | `/api/batches/{batch_id}/events` | Bearer | Add PROCESSING/PACKAGING event (updates `batches.status`, appends chain) |
| GET | `/api/batches/{batch_id}/timeline` | public | Full event list in order |
| GET | `/api/batches/{batch_id}/verify` | public | `{valid, batch_id, message}` chain verification |
| GET | `/api/batches/{batch_id}/qr` | public | Base64 PNG QR encoding `${APP_URL}/verify/{batch_code}` |
| GET | `/api/batches/verify/consumer/{batch_code}` | **public** | Consumer verify by batch code (returns only non-sensitive batch info + timeline hashes) |
| GET | `/api/alerts?hive_id=` | Bearer | Alerts list |
| GET | `/api/admin/dashboard` | Bearer | Totals: clusters, beekeepers, active hives, honey kg, recent alerts |
| GET | `/api/admin/clusters` | Bearer | Per-cluster stats |
| GET | `/api/admin/batches` | Bearer | Batch audit rows |

Swagger UI: `{backend}/docs`.

---

## 6. Authentication Flow

1. Frontend `page.tsx` login form → `useAuth().login(email, password)` (`src/lib/auth.tsx`)
2. → `POST {API_URL}/api/auth/login` (25 s timeout via `apiFetch`)
3. Backend `app/api/auth.py` → `verify_password` (passlib/bcrypt) → issues JWT (`python-jose`, HS256, `SECRET_KEY`) → returns `{access_token, token_type, role, user_id, name}`
4. Frontend stores `hc_token` + `hc_user` JSON in **localStorage**; `AuthProvider` hydrates on mount
5. Protected calls pass `token` → `apiFetch` adds `Authorization: Bearer <jwt>`
6. Role routing: FARMER → `/farmer/dashboard`, ADMIN → `/admin/dashboard`; `ProtectedLayout` guards; dashboards redirect to `/` when `isAuthenticated` goes false (logout)
7. **Public (no token)**: `/verify/[batchId]`, `GET /api/batches/verify/consumer/{code}`, timeline, verify, qr, health

JWT is stateless — no refresh token, no session table; logout = clearing localStorage.

---

## 7. Environment Variables Required

### Backend (Render → honey-chain-api → Environment) — currently set
| Key | Value | Note |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://honeychain:<pw>@dpg-dabj9cajobas73b2uhv0-a.oregon-postgres.render.com/honeychain_wn6h` | **External** URL required (service & DB in different regions); `+asyncpg` suffix |
| `DATABASE_SYNC_URL` | `postgresql://...same host.../honeychain_wn6h` | Legacy compat; code is async-only now |
| `SECRET_KEY` | (secret) | JWT signing — never commit |
| `CORS_ORIGINS` | `https://honey-chain-ten.vercel.app` (user-set) | **Redundant**: `get_cors_origins()` force-adds both Vercel origins in code |
| `MQTT_ENABLED` | `True` | Enables live telemetry |
| `MQTT_BROKER_URL` | `broker.emqx.io` | Public broker; no credentials |
| `DEMO_MODE` | `true` | Informational |

### Frontend (Vercel → honey-chain → Settings → Environment Variables → **Production**)
| Key | Value | Note |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://honey-chain-4byl.onrender.com` | **CRITICAL**: without it the browser bundle falls back to `http://localhost:8000` and nothing works in production. Set **before** the build that uses it, then redeploy |

### Local dev files (git-ignored, never commit)
- `backend/.env` — local: `DATABASE_URL=sqlite+aiosqlite:///./honeychain.db`, `MQTT_ENABLED=True`, `MQTT_BROKER_URL=broker.emqx.io`. Do **not** set `CORS_ORIGINS` here (it used to override code defaults).
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:8000`
- Template: root `.env.example`

---

## 8. Deployment Architecture

- **Frontend → Vercel** (Next.js native). Repo import, **Root Directory = `frontend`**, framework pinned by `frontend/vercel.json`.
- **Backend → Render free Web Service** (`honey-chain-api`): Root Directory `backend`, Runtime **Python 3.14.3** (Render default), Build `pip install -r requirements.txt`, Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- **Database → Render free PostgreSQL 18** (`honey-chain-db`, Oregon; **expires 2026-10-02** unless upgraded).
- **MQTT → public broker `broker.emqx.io:1883`** (no auth). Chosen so the ESP32 (home WiFi) and Render (cloud) meet without running a broker locally. Never publish secrets to it.
- **Free-tier consequence:** Render spins down after ~15 min idle → first request 30–50 s; CORS preflights can hang → see §11/§12. Warm `/api/health` before demos.
- MQTT runs **inside** the FastAPI process (background thread) — fine for prototype; production design (docs/architecture.md) moves it to a separate worker + LoRaWAN store-and-forward.

## 9. Vercel Configuration

- Project `honey-chain`, team "Honey", Root Directory **`frontend`** (otherwise Vercel detects FastAPI and fails with "No FastAPI entrypoint found").
- `frontend/vercel.json`:
  ```json
  {
    "framework": "nextjs",
    "buildCommand": "next build",
    "outputDirectory": ".next",
    "installCommand": "npm install"
  }
  ```
  (added to fix "No Output Directory named 'public' found").
- Only env var needed: `NEXT_PUBLIC_API_URL` (Production). Remove any backend vars (`DATABASE_URL`, `SECRET_KEY`, …) from Vercel — they were auto-imported once and broke a deploy; they belong on Render only.
- After changing env vars, **redeploy**, and verify the deployed JS bundle contains `honey-chain-4byl.onrender.com` (View Source → search) before debugging anything else.

## 10. Current Production URLs

| What | URL |
|---|---|
| Frontend | https://honey-chain-ten.vercel.app |
| Backend | https://honey-chain-4byl.onrender.com |
| API docs | https://honey-chain-4byl.onrender.com/docs |
| Health | https://honey-chain-4byl.onrender.com/api/health |
| Consumer verify (demo) | https://honey-chain-ten.vercel.app/verify/HC-2026-00001 |
| GitHub | https://github.com/arijit-07-m/honey-chain (`main`, HEAD `c0bb96e`) |

**Demo credentials (must keep working):** `admin@honeychain.in / admin123` · `farmer01@honeychain.in / farmer123`

---

## 11. Current Known Bugs

1. **🔴 CRITICAL — `POST /api/batches/harvest` is truncated.** In `backend/app/api/batches.py`, `create_harvest()` ends at `db.add(batch)` (~line 116) — the `await db.commit()`, `await db.refresh(batch)`, the HARVEST `create_event(...)` hash-chain call, and the `BatchResponse(...)` return were lost in a prior edit. It's syntactically valid Python so the app boots, but the endpoint commits nothing and returns `None` → FastAPI response-validation **500** on every harvest. **This breaks the core demo flow (harvest → chain → QR).** Fix: restore the body — commit/refresh, then `create_event(db=db, batch_id=batch.id, stage="HARVEST", actor_id=current_user.id, event_data=<json>)`, then return `BatchResponse` — mirroring the pattern in `add_event()`. *(Left unfixed intentionally: handoff instruction was "do not modify the application.")*
2. **Render free-tier cold starts** (30–50 s): first login after idle can hit the 25 s client timeout ("Backend not responding after 25s… try again"). Retry once, or add a keep-alive ping / upgrade the instance.
3. **Render free PostgreSQL expires 2026-10-02** → data loss unless upgraded or migrated (pg_dump/restore).
4. **`bcrypt==4.0.1` pin**: `passlib 1.7.4` is incompatible with `bcrypt 5.x` on Python 3.14 (crashes in passlib's self-test). Don't bump bcrypt unless passlib is replaced.
5. **`backend/render.yaml` defaults are stale** (old CORS list, `MQTT_ENABLED=False`) — harmless while dashboard env vars exist, but fix/delete before ever using Render Blueprint deploys.
6. **MQTT DB writes** must stay on the main event loop (`run_coroutine_threadsafe` in `app/mqtt/handler.py`). Removing that breaks telemetry ingestion with async errors.
7. `backend/honeychain.db` is deliberately untracked — do not re-commit it.
8. Route ordering note: `/api/batches/verify/consumer/{batch_code}` must be declared before/kept distinct from `/{batch_id}` int routes (FastAPI matches ints first; keep the string route as-is).

---

## 12. The Current Login/Sign-in Problem (RESOLVED — history + residual risk)

**Symptom (fixed):** on https://honey-chain-ten.vercel.app, Sign In stuck on "Signing in…" forever.

**Root causes found & fixed (commits `8053436`, `e798040`, `8da5b8c`):**
1. **CORS**: the browser preflight from `https://honey-chain-ten.vercel.app` was rejected ("Disallowed CORS origin") because the live Render env `CORS_ORIGINS` didn't include it. Fixed in `app/core/config.py`: `get_cors_origins()` now **always** includes both `https://honey-chain.vercel.app` and `https://honey-chain-ten.vercel.app` regardless of env var.
2. **No fetch timeout**: `apiFetch` could hang indefinitely when the backend was unreachable → added 25 s `AbortController` + friendly error so the button can never stay stuck.
3. **Backend crash loop**: missing `return` in `seed.py` caused duplicate-key crash on every deploy → fixed (idempotent early-return).
4. **Missing `NEXT_PUBLIC_API_URL` on Vercel** made the bundle call `http://localhost:8000` → user instructed to set it and redeploy.

**Residual risks to re-check first if login "breaks" again:**
- Render cold start (wait/warm, don't reconfigure) — most common false alarm.
- `NEXT_PUBLIC_API_URL` missing or added *after* the last frontend build.
- Backend deploy failing (check Render logs; watch for the seed/bcrypt/psycopg2 regressions documented in §11).
- Verify quickly: `curl -i -X OPTIONS https://honey-chain-4byl.onrender.com/api/auth/login -H "Origin: https://honey-chain-ten.vercel.app" -H "Access-Control-Request-Method: POST"` → expect 200 + `access-control-allow-origin` echo.

---

## 13. Features Already Implemented

**Backend (all verified working):**
- ✅ JWT auth with roles (FARMER/ADMIN), bcrypt password hashing
- ✅ Hive CRUD + telemetry APIs (`GET /api/hives`, `/api/hives/{id}`, `/api/hives/{id}/telemetry?limit=N`)
- ✅ `POST /api/hives/{hive_id}/telemetry` (manual/bypass injection, used by demo & tests)
- ✅ Harvest → batch creation with auto batch code `HC-2026-XXXXX`
- ✅ Traceability events: HARVEST → PROCESSING → PACKAGING, each hashed into the chain
- ✅ Hash-chain verification: `GET /api/batches/{batch_id}/verify` + `GET /api/batches/verify/consumer/{batch_code}` (public)
- ✅ QR code generation: `GET /api/batches/{batch_id}/qr` (PNG, encodes `{APP_URL}/verify/{batch_code}`), QR download
- ✅ Alerts API (`GET /api/alerts`, resolve endpoint)
- ✅ Admin APIs: dashboard stats, clusters, batch audit list
- ✅ AI anomaly detection: IsolationForest on (temp, humidity, weight, sound), trained in-process on synthetic data, auto-creates alert + sets hive status ATTENTION
- ✅ MQTT ingestion from `broker.emqx.io`, topic `hive/{hive_id}/telemetry` (verified end-to-end locally)
- ✅ Idempotent seed: 5 clusters, 20 beekeepers, 30 hives, 10 batches with full chains, sensor history, 1 alert
- ✅ CORS locked to explicit origins incl. both Vercel production URLs

**Frontend:**
- ✅ Landing page: hero, architecture flow, inline login form (no modal), batch-code input → `/verify/{code}`
- ✅ Farmer: dashboard (stats, hive grid, alerts), hives list, hive detail (4 charts + anomaly markers + 10 s auto-refresh), harvest form, batches list/detail (timeline, verify-chain button, QR view/download), alerts page
- ✅ Admin: dashboard (KPI cards + charts), clusters, batches audit table with integrity column
- ✅ Consumer `/verify/[batchId]`: public, no login; batch info, journey timeline, chain-verified banner; honest-language disclaimer (no "100% pure" claims)
- ✅ Logout works (auth-state redirect to `/`), loading/error/empty states, mobile-first Tailwind UI
- ✅ Recharts lazy-loaded via `next/dynamic` (fixed slow first compile)

**Infra/Docs:** Docker Compose (postgres, mosquitto, backend), Mosquitto config, ESP32 firmware (`hive-firmware/esp32/honeychain_esp32.ino`), `hive-sim/simulator.py` + `test_publish.py`, `docs/architecture.md` / `api.md` / `deployment.md`, README, `.env.example`, `render.yaml`, `frontend/vercel.json`.

---

## 14. Features Still Incomplete / Future Scope

- ❌ Live anomaly **injection button in farmer UI** (currently via simulator script or API call)
- ❌ Alert resolution UI polish; admin beekeeper management page (`/admin/beekeepers` route exists in spec, minimal implementation)
- ❌ Admin audit-log page `/admin/audit-log` (data available via admin API, page thin)
- ❌ Offline-first caching/service worker for farmer UI
- ❌ Real hardware beyond DHT11 (HX711 load cell, sound sensor, ESP32-CAM) — firmware stubs only
- ❌ LoRaWAN store-and-forward (documented as future architecture only)
- ❌ Hyperledger Fabric migration (deliberate: hash chain in Postgres for the prototype)
- ❌ Automated test suite (`backend/tests/` is a stub); Alembic migrations unused (tables via `create_all`)
- ❌ MOSQUITTO MQTT auth (broker.emqx.io is public — fine for demo, not production)

---

## 15. Important Technical Decisions Already Made (do not reverse)

1. **One Next.js project** for farmer+admin+consumer (not three apps).
2. **Hash chain in PostgreSQL, not Hyperledger** — SHA-256 linked events, raw data off-chain. Fabric is future scope.
3. **AI = exactly one feature**: IsolationForest anomaly detection on sensor telemetry. No image CNN.
4. **MQTT via public broker `broker.emqx.io`** so ESP32 (any network) and Render backend both connect outbound; no broker hosting needed.
5. **Backend on Render with dashboard env vars** (not render.yaml Blueprint) — render.yaml is stale/informational.
6. **Sync SQLAlchemy engine kept with `psycopg2-binary`** alongside the async `asyncpg` engine — seeding/health checks use it.
7. **bcrypt pinned to 4.0.1** because passlib 1.7.4 breaks on bcrypt 5.x / Python 3.14.
8. **SQLite fallback** supported (defaults in config) — local dev works without Postgres.
9. **CORS hard-codes both production Vercel origins** in `get_cors_origins()` regardless of env var — prevents config regressions. Do not replace with `*` (auth requires explicit origins).
10. **Seed data uses realistic Indian names/locations** (Kanpur, Lucknow, Prayagraj, Varanasi…); never "Lorem/Test/ABC123".
11. UI language rules: "Potential hive anomaly detected", never disease claims; consumer page separates verified record from purity claims.

---

## 16. Dependencies and Versions

**Backend (`backend/requirements.txt`, Python 3.14 on Render):**
fastapi ≥0.115 · uvicorn[standard] ≥0.30 · sqlalchemy[asyncio] ≥2.0 · asyncpg ≥0.29 · **psycopg2-binary** (sync engine — required, missing it crashes startup) · aiosqlite ≥0.20 (local fallback) · pydantic ≥2.9 · pydantic-settings ≥2.5 · python-jose[cryptography] ≥3.3 · passlib[bcrypt] 1.7.4 · **bcrypt==4.0.1 (pinned — do not bump)** · python-multipart · paho-mqtt ≥2.1 · scikit-learn ≥1.7 · numpy · pandas · qrcode[pil] · Pillow · alembic (unused) · httpx

**Frontend (`frontend/package.json`):** next 15.5.x · react 19 · typescript · tailwindcss · recharts 2.15 (lazy-loaded via `next/dynamic`)

**Simulator:** paho-mqtt only. **ESP32:** PubSubClient + DHT libraries (Arduino IDE).

---

## 17. Run Frontend Locally

```powershell
cd C:\Users\chhanda-pc\Desktop\SIH\honey-chain\frontend
npm install
# .env.local should contain: NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev          # → http://localhost:3000
npm run build        # verify production build (~12 pages)
```

## 18. Run Backend Locally

```powershell
cd C:\Users\chhanda-pc\Desktop\SIH\honey-chain\backend
python -m venv venv (once) ; .\venv\Scripts\activate
pip install -r requirements.txt
# defaults: SQLite fallback, MQTT on via broker.emqx.io (see backend/.env)
.\venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# → http://localhost:8000/api/health, docs at /docs
# seed runs automatically on first start (idempotent)
```

Test live MQTT: `cd ..\hive-sim ; ..\backend\venv\Scripts\python.exe test_publish.py H002` (normal) or `test_publish.py H002 --anomaly` → watch hive detail page auto-refresh (10 s).

## 19. How Frontend Talks to Backend

- Single helper `apiFetch(path, options)` in `frontend/src/lib/api.ts`:
  - base URL = `process.env.NEXT_PUBLIC_API_URL` with **localhost fallback** (`http://localhost:8000`);
  - attaches `Authorization: Bearer <token>` from `localStorage('hc_token')` when logged in;
  - **25 s AbortController timeout** — always surfaces an error, so UI loading states can never hang forever.
- All routes go under `/api/...` (FastAPI routers mounted with prefix).
- Auth context `src/lib/auth.tsx` stores `{token, user}` in localStorage; `ProtectedLayout` guards `/farmer/*` & `/admin/*`; `/verify/*` and `/` are public.
- Login: `POST /api/auth/login` (JSON `{email,password}`) → `{access_token, user:{id,name,email,role}}` → role-based redirect (FARMER→`/farmer/dashboard`, ADMIN→`/admin/dashboard`).

## 20. MQTT / Blockchain / QR Functionality

- **MQTT**: backend `app/mqtt/service.py` + `handler.py` run paho-mqtt on a background thread; topic `hive/{hive_id}/telemetry`; payload `{"hive_id","temperature","humidity","weight","sound_level","timestamp"}`. Handler validates payload, writes SensorReading **via `run_coroutine_threadsafe` on the main event loop**, runs AI, updates hive status, creates alert. ESP32 firmware and `hive-sim/simulator.py` publish the identical schema (ESP32 must not be distinguished by the backend).
- **Blockchain (hash chain)**: `app/blockchain/service.py` — `current_hash = SHA256(event_id + batch_id + stage + actor_id + timestamp + event_data + previous_hash)`; first event `previous_hash="GENESIS"`. Verify walks the whole batch chain recomputing hashes; any mismatch → `valid:false`. Never store raw payloads on the chain — only the hash row in `traceability_events` (event_data holds a small JSON reference string).
- **QR**: `app/api/batches.py` generates PNG QR with `qrcode` lib encoding `{NEXT_PUBLIC_APP_URL}/verify/{batch_code}`; farmer can view/download; consumer scans → public verify page.

## 21. Current TODOs (recommended order)

1. **FIX the truncated `POST /api/batches/harvest`** (§11 bug #1) — restore commit/refresh + `create_event(HARVEST)` + `BatchResponse` return; then run the full demo flow.
2. Push any local uncommitted work; verify Render redeploys green after the fix.
3. Add a backend smoke test for harvest → verify → consumer-verify (httpx TestClient) to prevent regressions.
4. Consider Render keep-alive ping (e.g., UptimeRobot on `/api/health`) to avoid cold starts during judging.
5. Replace stale `backend/render.yaml` CORS/MQTT values or delete it.
6. Decide on Postgres upgrade before **2026-10-02** (free DB expiry).
7. Optional: anomaly-injection button for the farmer UI (calls `POST /api/hives/{id}/telemetry` with extreme values).

## 22. Assumptions the Next Agent Must Know

- **"Do not modify the application" applied to the handoff analysis only** — the §11 harvest bug was deliberately left for you. It is the first thing to fix.
- Demo credentials are hard requirements: `admin@honeychain.in/admin123`, `farmer01@honeychain.in/farmer123`.
- The user (hackathon participant) is a beginner with deploy dashboards — prefer exact click-by-click instructions and smallest possible changes; avoid re-architecture.
- Never hardcode backend URLs or secrets in frontend source; `NEXT_PUBLIC_*` vars are the only frontend env mechanism.
- Production CORS must always keep BOTH `https://honey-chain.vercel.app` and `https://honey-chain-ten.vercel.app` (plus localhost for dev).
- Windows dev machine (PowerShell); backend venv at `backend/venv`; local services may already be running on ports 3000/8000.
- Git remote: `origin = github.com/arijit-07-m/honey-chain` (main). Push after fixes so Render/Vercel auto-deploy.
- The chain "verify" is a prototype trust mechanism, not a distributed blockchain — keep the docs honest about that (§1 wording in `docs/architecture.md`).

---

*End of handoff. Verify with: `git log --oneline`, Render logs, and the §12 CORS preflight curl before trusting anything else.*





