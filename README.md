# Smart Helmet — Industrial Safety Monitoring System

Real-time IoT safety monitoring for industrial workers using ESP32 helmets, MQTT, FastAPI, PostgreSQL, and a Next.js PWA dashboard with live GPS mapping and Admin Authentication.

---

## Capabilities Added
* **Real-time GPS Tracking**: Tracks worker locations on a dashboard map using Leaflet.
* **Admin Authentication**: Secure JWT-based registration and login system.
* **Worker Management**: Multi-admin architecture allowing admins to register, rename, and remove workers.
* **Hardware Integrated IoT**: Fall detection, hazardous gas alerts (MQ-2), and ambient temperature streaming in real-time.

---

## Architecture Overview

```
ESP32 (helmet)
  │  publishes JSON over MQTT (includes GPS & Sensors)
  ▼
Mosquitto Broker (localhost:1883)
  │  topic: helmet/sensor/{worker_id}
  ▼
FastAPI Backend (MQTT Subscriber)
  ├── Persists reading → PostgreSQL
  ├── Recomputes worker status (alert_logic)
  └── Broadcasts update → WebSocket /ws
        ▼
Next.js PWA Frontend (Dashboard, Auth, Live Leaflet Map)
```

---

## Tech Stack

### Backend

| Layer | Technology |
|---|---|
| API | FastAPI (async) |
| MQTT client | aiomqtt ≥ 2.3.0 (async) |
| Authentication | python-jose, passlib (bcrypt JWT auth) |
| Database | PostgreSQL |
| ORM | SQLAlchemy 2 (asyncio) |
| Validation | Pydantic v2 |
| Real-time | WebSockets |

### Frontend

| Layer | Technology |
|---|---|
| Framework | Next.js 14 |
| Language | TypeScript + React 18 |
| Map/GIS | Leaflet + react-leaflet |
| Styling | Tailwind CSS |
| PWA | @ducanh2912/next-pwa |
| Icons | lucide-react |

---

## Project Structure

```
Helmet/
├── app/                          # FastAPI backend
│   ├── main.py                   # App factory, lifespan, CORS, routers
│   ├── config.py                 # Settings loaded from .env (including JWT)
│   ├── database.py               # Async engine + session factory
│   ├── models.py                 # Admin, Worker, and SensorData ORM models
│   ├── schemas.py                # Pydantic request/response schemas
│   ├── services/
│   │   ├── mqtt_subscriber.py    # Async MQTT subscriber (parses GPS data)
│   │   └── alert_logic.py        # Rolling-average alert + status logic
│   └── routes/
│       ├── auth.py               # POST /auth/login, /auth/register
│       ├── admin.py              # Protected worker management CRUD
│       ├── sensor.py             # POST /sensor-data (HTTP fallback)
│       ├── workers.py            # GET /workers, /alerts, /worker/{id}/history
│       ├── deps.py               # JWT Bearer auth dependencies
│       └── websocket.py          # WebSocket /ws + ConnectionManager
├── frontend/                     # Next.js PWA dashboard
│   ├── app/                      # App Router pages (login, map, profile, dash)
│   ├── components/               # React components (WorkerMap, AuthGuard, etc.)
│   └── lib/auth.ts               # LocalStorage token management
├── requirements.txt
├── .env.example
├── migrate_gps_auth.py           # One-time DB migration script
└── README.md
```

---

## Alert Status Logic

Priority-ordered rules evaluated on every incoming MQTT message:

| Priority | Status | Condition |
|---|---|---|
| 1 | **FALL** | `fall_detected = true` (immediate, single reading) |
| 2 | **CRITICAL** | Rolling avg of last 5 gas readings > **300** |
| 3 | **WARNING** | Rolling avg of last 5 gas readings > **200** |
| 4 | **INACTIVE** | No reading received in the last **30 seconds** |
| 5 | **SAFE** | None of the above |

---

## MQTT Payload Format

**Topic:** `helmet/sensor/{worker_id}`

```json
{
  "worker_id": "W101",
  "gas_level": 108,
  "fall_detected": false,
  "temperature": 30.0,
  "latitude": 28.6139,
  "longitude": 77.2090,
  "gps_valid": true
}
```
*Note: `latitude`, `longitude`, and `gps_valid` are optional to support legacy helmets.*

### WebSocket broadcast (sent to all connected frontend clients)

```json
{
  "worker_id": "W101",
  "status": "SAFE",
  "gas_level": 108,
  "fall_detected": false,
  "temperature": 30.0,
  "fall_acknowledged": true,
  "timestamp": "2026-04-06T01:43:00+00:00",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "gps_valid": true
}
```

---

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL running locally (or Docker)
- Mosquitto MQTT broker installed

### 1. Install & start Mosquitto

```bash
sudo apt install mosquitto mosquitto-clients
sudo systemctl start mosquitto
```

### 2. Create the database

```sql
CREATE DATABASE helmet_db;
```

### 3. Configure backend environment

```bash
cp .env.example .env
# Edit .env:
# DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/helmet_db
# MQTT_BROKER=localhost
# MQTT_PORT=1883
# MQTT_TOPIC_PREFIX=helmet/sensor
# JWT_SECRET=your-random-strong-secret
```

### 4. Create and activate a Python virtual environment

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 5. Run Database Migration

Includes the necessary tables for authentication and columns for GPS.

```bash
python migrate_gps_auth.py
```

### 6. Run the backend

```bash
uvicorn app.main:app --reload
```

Backend available at **http://localhost:8000** · Docs at **http://localhost:8000/docs**

### 7. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at **http://localhost:3000**

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/auth/register` | Register a new Admin account |
| `POST` | `/auth/login` | Login taking `username` and `password` to receive JWT |
| `GET` | `/workers` | List all workers + current status |
| `POST` | `/admin/workers` | [Auth required] Register a new worker to the admin |
| `PUT` | `/admin/workers/{worker_id}/name` | [Auth required] Rename a worker |
| `DELETE`| `/admin/workers/{worker_id}` | [Auth required] Delete a worker |
| `GET` | `/alerts` | Workers in WARNING / CRITICAL / FALL / INACTIVE |
| `GET` | `/worker/{id}/history` | Time-series readings (`?limit=50`) |
| `WS` | `/ws` | Real-time worker status broadcast containing telemetry + GPS |

---

## Testing MQTT Alerts

Use `mosquitto_pub` to inject test readings without an ESP32.

**Test GPS Data & Location Update:**
```bash
mosquitto_pub -h localhost -t "helmet/sensor/W101" \
  -m '{"worker_id":"W101","gas_level":50,"fall_detected":false,"temperature":30.0,"latitude":28.6139,"longitude":77.2090,"gps_valid":true}'
```

**Test CRITICAL Alert (send 5×):**
```bash
for i in {1..5}; do
  mosquitto_pub -h localhost -t "helmet/sensor/W101" \
    -m '{"worker_id":"W101","gas_level":320,"fall_detected":false,"temperature":30.0}'
done
```

---

## Docker (PostgreSQL only)

```bash
docker run --name helmet-pg \
  -e POSTGRES_DB=helmet_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 -d postgres:16
```