"""
websocket.py — WebSocket connection manager and /ws endpoint.

All active clients receive a JSON broadcast whenever a worker's status changes.
"""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.models import SensorData, Worker

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


# ---------------------------------------------------------------------------
# Connection manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    """Thread-safe (single-process async) manager for active WebSocket clients."""

    def __init__(self) -> None:
        self._active: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._active.append(websocket)
        logger.info("WS client connected. Total: %d", len(self._active))

    def disconnect(self, websocket: WebSocket) -> None:
        self._active.remove(websocket)
        logger.info("WS client disconnected. Total: %d", len(self._active))

    async def broadcast(self, payload: dict) -> None:
        """Send *payload* as JSON to every connected client."""
        message = json.dumps(payload, default=str)
        dead: list[WebSocket] = []
        for ws in self._active:
            try:
                await ws.send_text(message)
            except Exception:
                logger.warning("Failed to send to a client; scheduling disconnect.")
                dead.append(ws)
        for ws in dead:
            self._active.remove(ws)


# Singleton shared across the app
manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Broadcast helper — called from sensor route and MQTT subscriber
# ---------------------------------------------------------------------------

async def broadcast_worker_update(worker: Worker, sensor: SensorData, anomaly_predicted: bool = False) -> None:
    """
    Broadcast a flat worker-status message to all connected WS clients.

    Message shape:
        {
            "worker_id": "W101",
            "name": "John Doe",
            "status": "CRITICAL",
            "gas_level": 320,
            "fall_detected": false,
            "temperature": 32.5,
            "fall_acknowledged": false,
            "latitude": 28.6139,
            "longitude": 77.2090,
            "gps_valid": true,
            "timestamp": "2024-01-01T12:00:00+00:00"
        }
    """
    payload = {
        "worker_id": worker.worker_id,
        "name": worker.name,
        "status": worker.status.value,
        "gas_level": sensor.gas_level,
        "fall_detected": sensor.fall_detected,
        "temperature": sensor.temperature,
        "fall_acknowledged": worker.fall_acknowledged,
        "anomaly_predicted": anomaly_predicted,
        "activity": worker.activity,
        "latitude": sensor.latitude,
        "longitude": sensor.longitude,
        "gps_valid": sensor.gps_valid,
        "timestamp": sensor.timestamp.isoformat(),
    }
    await manager.broadcast(payload)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    Real-time worker status updates.

    Clients connect and receive JSON messages whenever POST /sensor-data is called.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive; we don't process client messages.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
