# 🍯 Honey Chain

**Blockchain-Based Honey Traceability & Smart Beekeeping Management**

Honey Chain is a prototype system developed for the **Ministry of MSME — SIH 2026** (Problem Statement #26021). It addresses counterfeit honey, lack of product traceability, and limited access to data-driven beekeeping.

---

## ✨ Key Features

- **Smart Hive Monitoring** — Real-time temperature, humidity, weight, and sound monitoring
- **AI Anomaly Detection** — Identifies potential hive issues using machine learning
- **Immutable Traceability** — SHA-256 hash chain creates tamper-evident batch records
- **QR Code Verification** — Consumers scan QR codes to verify honey authenticity
- **Farmer Dashboard** — Mobile-first interface for rural beekeepers
- **Admin Analytics** — KVIC/cluster-level monitoring and audit

---

## 🏗️ Architecture

```
Hive → Sensor → MQTT → FastAPI → AI → PostgreSQL → Hash Chain → QR → Consumer
```

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, SQLAlchemy |
| Database | PostgreSQL |
| MQTT | Mosquitto |
| AI/ML | scikit-learn (Isolation Forest) |
| Blockchain | SHA-256 Hash Chain (PostgreSQL) |
| Deployment | Vercel (frontend) + Cloud VM (backend) |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker & Docker Compose (optional, for PostgreSQL + Mosquitto)

### 1. Clone & Setup

```bash
cd honey-chain
```

### 2. Start Infrastructure (Docker)

```bash
docker-compose up -d postgres mosquitto
```

### 3. Start Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Start Simulator (Optional)

```bash
cd hive-sim
pip install -r requirements.txt
python simulator.py
```

### 6. Open Application

- **Frontend:** http://localhost:3000
- **API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

---

## 🔐 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@honeychain.in | admin123 |
| Farmer 01 | farmer01@honeychain.in | farmer123 |
| Farmer 02 | farmer02@honeychain.in | farmer123 |

---

## 📱 Application Routes

```
/                    Landing page
/farmer/dashboard    Farmer dashboard
/farmer/hives        Hive list
/farmer/hives/[id]   Hive details with telemetry
/farmer/harvest      Create harvest batch
/farmer/batches      Batch list
/farmer/alerts       Alert list
/admin/dashboard     Admin dashboard
/admin/clusters      Cluster management
/admin/batches       Batch audit
/verify/[batchCode]  Consumer verification
```

---

## 🔗 Demo Flow (3-Minute Presentation)

1. **Farmer Dashboard** — Shows 5 hives, 1 needs attention
2. **Hive H002** — Live telemetry with anomaly detection
3. **AI Anomaly** — Alert showing unusual weight drop
4. **Create Harvest** — New batch HC-2026-00001
5. **Traceability Timeline** — Harvest → Processing → Packaging
6. **Verify Chain** — Blockchain integrity verified
7. **QR Code** — Scan to verify
8. **Consumer Page** — Verified honey journey

---

## 🧪 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/hives | List hives |
| GET | /api/hives/{id} | Hive details |
| GET | /api/hives/{id}/telemetry | Sensor history |
| POST | /api/batches/harvest | Create harvest |
| GET | /api/batches | List batches |
| GET | /api/batches/{id} | Batch details |
| POST | /api/batches/{id}/events | Add event |
| GET | /api/batches/{id}/timeline | Timeline |
| GET | /api/batches/{id}/verify | Verify chain |
| GET | /api/batches/verify/consumer/{code} | Consumer verify |
| GET | /api/alerts | List alerts |
| GET | /api/admin/dashboard | Admin stats |
| GET | /api/admin/clusters | Cluster stats |

---

## 📦 Project Structure

```
honey-chain/
├── frontend/           # Next.js application
├── backend/            # FastAPI application
├── hive-sim/           # Sensor simulator
├── hive-firmware/      # ESP32 firmware
├── database/           # Migrations & seed
├── docs/               # Documentation
└── docker-compose.yml  # Infrastructure
```

---

## 🛡️ Security

- Password hashing (bcrypt)
- JWT authentication
- Role-based access control
- Input validation (Pydantic)
- SQL injection protection (SQLAlchemy)
- Environment variables for secrets
- CORS configuration

---

## 📄 License

SIH 2026 — Ministry of MSME

---

## 👥 Team

Built for **Smart India Hackathon 2026**