# Honey Chain — API Documentation

## Base URL

Development: `http://localhost:8000`
Production: `https://your-backend-url.com`

## Authentication

Most endpoints require a JWT Bearer token.

### Login

```
POST /api/auth/login
```

**Request:**
```json
{
  "email": "farmer01@honeychain.in",
  "password": "farmer123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "role": "FARMER",
  "user_id": 1,
  "name": "Rajesh Kumar"
}
```

## Hives

### List Hives
```
GET /api/hives?farmer_id=1
```

### Get Hive Details
```
GET /api/hives/{hive_id}
```

### Get Hive Telemetry
```
GET /api/hives/{hive_id}/telemetry?limit=50
```

## Batches

### List Batches
```
GET /api/batches
```

### Get Batch Details
```
GET /api/batches/{batch_id}
```

### Create Harvest (Create Batch)
```
POST /api/batches/harvest
```

**Request:**
```json
{
  "hive_id": 1,
  "honey_type": "Mustard Honey",
  "harvest_date": "2026-09-01T12:00:00Z",
  "quantity": 18.2,
  "location": "Kanpur",
  "notes": "Good quality honey"
}
```

### Add Event
```
POST /api/batches/{batch_id}/events
```

**Request:**
```json
{
  "stage": "PROCESSING",
  "event_data": "Honey extracted and filtered"
}
```

### Get Timeline
```
GET /api/batches/{batch_id}/timeline
```

### Verify Chain
```
GET /api/batches/{batch_id}/verify
```

**Response:**
```json
{
  "valid": true,
  "batch_id": "HC-2026-00001",
  "message": "Chain integrity verified"
}
```

### Get QR Code
```
GET /api/batches/{batch_id}/qr
```

### Consumer Verify (Public)
```
GET /api/batches/verify/consumer/{batch_code}
```

## Alerts

### List Alerts
```
GET /api/alerts?hive_id=2&resolved=false&limit=20
```

## Admin

### Dashboard
```
GET /api/admin/dashboard
```

### Clusters
```
GET /api/admin/clusters
```

### All Batches
```
GET /api/admin/batches
```

## Health Check
```
GET /api/health
```