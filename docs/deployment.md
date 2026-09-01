# Honey Chain — Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Vercel                             │
│              Next.js Frontend                        │
│         https://honeychain.vercel.app                │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              Cloud Service (Render/Railway/Fly.io)   │
│              FastAPI Backend                         │
│         https://honeychain-api.onrender.com          │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              Managed PostgreSQL                      │
│              (Supabase / Render / Aiven)             │
└─────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              VM / Cloud Broker                       │
│              Mosquitto MQTT                          │
└─────────────────────────────────────────────────────┘
```

## Frontend Deployment (Vercel)

1. Push the `frontend/` directory to a GitHub repository.
2. Import the project in Vercel.
3. Configure environment variables:
   - `NEXT_PUBLIC_API_URL`: Backend API URL
   - `NEXT_PUBLIC_APP_URL`: Frontend URL
4. Deploy.

## Backend Deployment

### Option 1: Render
1. Create a new Web Service from the `backend/` directory.
2. Set build command: `pip install -r requirements.txt`
3. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. Configure environment variables.

### Option 2: Railway
1. Create a new project from the `backend/` directory.
2. Platform auto-detects Python/FastAPI.
3. Configure environment variables.

## Database

### Managed PostgreSQL
- Use Supabase, Render PostgreSQL, or Aiven.
- Set `DATABASE_URL` and `DATABASE_SYNC_URL` in backend environment.

### Seed Data
After deployment, the backend auto-seeds demo data on first startup.

## MQTT Broker

### Option 1: Cloud Mosquitto
- Deploy Mosquitto on a small VM or use a cloud MQTT service.
- Configure `MQTT_BROKER_URL` and `MQTT_BROKER_PORT`.

### Option 2: Docker on VM
```bash
docker run -d -p 1883:1883 -p 9001:9001 eclipse-mosquitto:2
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Async PostgreSQL connection string |
| `DATABASE_SYNC_URL` | Sync PostgreSQL connection string |
| `MQTT_BROKER_URL` | MQTT broker address |
| `MQTT_BROKER_PORT` | MQTT broker port |
| `MQTT_USERNAME` | MQTT username (optional) |
| `MQTT_PASSWORD` | MQTT password (optional) |
| `SECRET_KEY` | JWT signing secret |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `NEXT_PUBLIC_API_URL` | API URL for frontend |
| `NEXT_PUBLIC_APP_URL` | Frontend URL for QR codes |
| `DEMO_MODE` | Enable/disable demo mode |

## Production Considerations

### Scaling (KVIC Deployment)
```
Multiple Hives
      ↓
LoRaWAN Gateway
      ↓
Store-and-Forward
      ↓
4G / WiFi / Phone Sync
      ↓
Central Backend
      ↓
Database + Permissioned Blockchain
      ↓
Farmer/Admin/Consumer Applications
```

### Performance
- Use connection pooling for PostgreSQL
- Cache frequent queries
- Use async handlers for sensor ingestion
- Batch sensor writes when possible

### Security
- Use strong SECRET_KEY
- Enable MQTT authentication
- Use HTTPS
- Implement rate limiting
- Regular security audits