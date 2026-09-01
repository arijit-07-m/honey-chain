# Honey Chain — Architecture Documentation

## Overview

Honey Chain is a blockchain-based honey traceability and smart beekeeping management system developed for the Ministry of MSME's SIH 2026 problem statement #26021.

The system connects: **Hive → Sensor → MQTT → Backend → AI → Database → Traceability Hash Chain → QR → Consumer**.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HONEY CHAIN SYSTEM                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐  │
│  │   ESP32  │    │  Python  │    │  Mobile  │    │    Admin     │  │
│  │(Hardware)│    │Simulator │    │ (Farmer) │    │  Dashboard   │  │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘    └──────┬───────┘  │
│       │               │               │                 │          │
│       └───────┬───────┘               │                 │          │
│               │                       │                 │          │
│         ┌─────▼──────┐               │                 │          │
│         │   MQTT     │               │                 │          │
│         │  Mosquitto │               │                 │          │
│         └─────┬──────┘               │                 │          │
│               │                      │                 │          │
│         ┌─────▼──────────────────────┴─────────────────▼──────┐   │
│         │                 FastAPI Backend                       │   │
│         │  ┌─────────┐  ┌─────────┐  ┌────────────────────┐   │   │
│         │  │  Auth   │  │  MQTT   │  │  Blockchain        │   │   │
│         │  │ Service │  │ Handler │  │  Hash Chain        │   │   │
│         │  └─────────┘  └─────────┘  └────────────────────┘   │   │
│         │  ┌─────────┐  ┌─────────┐  ┌────────────────────┐   │   │
│         │  │   AI    │  │  Batch  │  │  QR Code           │   │   │
│         │  │Anomaly  │  │ Service │  │  Generator          │   │   │
│         │  └─────────┘  └─────────┘  └────────────────────┘   │   │
│         └──────────────────────┬───────────────────────────────┘   │
│                                │                                   │
│         ┌──────────────────────▼───────────────────────────────┐   │
│         │                 PostgreSQL                            │   │
│         │  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐  │   │
│         │  │ Users    │ │ Hives    │ │ Sensor Readings       │  │   │
│         │  ├──────────┤ ├──────────┤ ├──────────────────────┤  │   │
│         │  │ Batches  │ │ Trace    │ │ Alerts                │  │   │
│         │  │          │ │ Events   │ │                       │  │   │
│         │  └──────────┘ └──────────┘ └──────────────────────┘  │   │
## Blockchain Approach

### Current Implementation (Prototype)

Honey Chain uses a **tamper-evident hash chain stored in PostgreSQL** for the prototype.

**Why not Hyperledger Fabric?**
- 36-hour hackathon timeline
- Faster implementation and debugging
- Easier deployment
- Reliable live demonstration
- Still demonstrates core blockchain principles

**How it works:**

Every traceability event contains:
- `event_id`
- `batch_id`
- `stage`
- `actor_id`
- `timestamp`
- `event_data` (reference/description, NOT raw data)
- `previous_hash`
- `current_hash`

Hash calculation:
```
current_hash = SHA256(
    event_id + batch_id + stage + actor_id + timestamp + event_data + previous_hash
)
```

The first event uses `previous_hash = "GENESIS"`. Each subsequent event references the previous event's hash, creating an immutable chain.

**Important:** Raw sensor data and large operational records are stored in PostgreSQL, NOT on the hash chain. The hash chain only stores cryptographic hashes with references/metadata. This design reduces storage requirements while maintaining tamper evidence.

### Production Migration

The system supports migration to a permissioned Hyperledger Fabric network in production:
- Replace the hash-chain table with Fabric chaincode
- Maintain PostgreSQL for raw operational data
- Use Fabric for consensus and immutable event logging
- Keep the same API layer

## Data Flow

### Sensor Data Flow
```
ESP32/Simulator → MQTT (Mosquitto) → FastAPI MQTT Handler → PostgreSQL Sensor Readings
                                                                    ↓
                                                              AI Anomaly Detector
                                                                    ↓
                                                              Alert Creation
                                                                    ↓
                                                              Dashboard Display
```

### Traceability Flow
```
Farmer Harvest → Create Batch → Generate Hash → QR Code → Consumer Verification
                      ↓
              Processing Event → New Hash → Chain Extended
                      ↓
              Packaging Event → New Hash → Chain Extended
                      ↓
              Verify Chain Integrity
```

## Key Design Decisions

1. **Single Next.js App**: Farmer, Admin, and Consumer interfaces are routes within one Next.js project.
2. **Off-chain Data**: PostgreSQL stores all operational data; hash chain stores only cryptographic proofs.
3. **Synthetic AI Training**: The anomaly detection model is trained on synthetic data for demo purposes.
4. **MQTT Independence**: Backend doesn't distinguish between real ESP32 and simulated data.
5. **Mobile-First Farmer UI**: Designed for rural beekeepers with large buttons, simple language, and high contrast.

## Tech Stack

| Component    | Technology               |
|-------------|--------------------------|
| Frontend    | Next.js, TypeScript, Tailwind CSS |
| Backend     | Python, FastAPI, SQLAlchemy |
| Database    | PostgreSQL               |
| MQTT Broker | Mosquitto                |
| AI/ML       | scikit-learn (Isolation Forest) |
| QR Code     | qrcode (Python library)  |
| Deployment  | Vercel (frontend), Render/Railway (backend) |

## Future Scope

- Hyperledger Fabric migration
- Live disease image detection
- ESP32-CAM integration
- Real load-cell (HX711) and sound sensors
- LoRaWAN gateway for rural connectivity
- Native Android/iOS app
- Advanced ML models
- Marketplace and payment gateway
│         └──────────────────────────────────────────────────────┘   │
│                                │                                   │
│         ┌──────────────────────▼───────────────────────────────┐   │
│         │              Next.js Frontend (Vercel)                │   │
│         │  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐  │   │
│         │  │  Farmer  │ │  Admin   │ │  Consumer Verify     │  │   │
│         │  │ Interface│ │Dashboard │ │  Public Page         │  │   │
│         │  └──────────┘ └──────────┘ └──────────────────────┘  │   │
│         └──────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```