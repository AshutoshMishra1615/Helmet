"""
mqtt_subscriber.py — Async MQTT subscriber service.

Connects to the Mosquitto broker and subscribes to all helmet sensor topics.
For each incoming message it runs the same DB + alert + WebSocket pipeline
as the HTTP POST /sensor-data route.

Topic pattern:  helmet/sensor/{worker_id}

Message payload (JSON):
    {
        "worker_id": "W101",
        "gas_level": 220,
        "fall_detected": false,
        "temperature": 32.5,
        "latitude": 28.6139,      ← optional GPS fields
        "longitude": 77.2090,
        "gps_valid": true
    }
"""

import json
import logging
from datetime import datetime, timezone

import aiomqtt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import SensorData, Worker, WorkerStatus
from app.routes.websocket import broadcast_worker_update
from app.services.alert_logic import compute_status, get_recent_gas_levels, get_recent_fall_flags
from app.services.ml_activity import predict_activity
from app.services.ml_predictor import predict_gas_trend_anomaly

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Core message handler — reuses the same logic as POST /sensor-data
# ---------------------------------------------------------------------------

async def _handle_message(payload: dict) -> None:
    """Persist the reading, recompute worker status, and broadcast via WebSocket."""

    worker_id: str = payload["worker_id"]
    gas_level: int = int(payload["gas_level"])
    fall_detected: bool = bool(payload["fall_detected"])
    temperature: float = float(payload["temperature"])

    # Optional GPS fields
    gps_valid: bool = bool(payload.get("gps_valid", False))
    latitude: float | None = float(payload["latitude"]) if gps_valid and "latitude" in payload else None
    longitude: float | None = float(payload["longitude"]) if gps_valid and "longitude" in payload else None

    import struct
    def _decode_accel(val: float | None) -> float | None:
        if val is None:
            return None
        # If the reading is an extreme number, ESP32 accidentally serialized raw cast bits instead of float string
        if abs(val) > 100000:
            try:
                return struct.unpack('f', struct.pack('i', int(val)))[0]
            except Exception:
                return val
        return val

    # Optional Accelerometer
    accel_x: float | None = _decode_accel(float(payload["accel_x"])) if "accel_x" in payload else None
    accel_y: float | None = _decode_accel(float(payload["accel_y"])) if "accel_y" in payload else None
    accel_z: float | None = _decode_accel(float(payload["accel_z"])) if "accel_z" in payload else None

    async with AsyncSessionLocal() as db:
        async with db.begin():
            await _process_reading(
                db, worker_id, gas_level, fall_detected, temperature,
                latitude, longitude, gps_valid, accel_x, accel_y, accel_z
            )


async def _process_reading(
    db: AsyncSession,
    worker_id: str,
    gas_level: int,
    fall_detected: bool,
    temperature: float,
    latitude: float | None,
    longitude: float | None,
    gps_valid: bool,
    accel_x: float | None,
    accel_y: float | None,
    accel_z: float | None,
) -> None:
    # 1. Upsert Worker
    result = await db.execute(select(Worker).where(Worker.worker_id == worker_id))
    worker: Worker | None = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if worker is None:
        logger.info("MQTT: New worker detected: %s — creating record.", worker_id)
        worker = Worker(
            worker_id=worker_id,
            name=worker_id,
            status=WorkerStatus.INACTIVE,
            last_seen=now,
        )
        db.add(worker)
        await db.flush()

    previous_last_seen = worker.last_seen

    # 2. Persist sensor reading (with GPS)
    sensor_record = SensorData(
        worker_id=worker_id,
        timestamp=now,
        gas_level=gas_level,
        fall_detected=fall_detected,
        temperature=temperature,
        latitude=latitude,
        longitude=longitude,
        gps_valid=gps_valid,
    )
    db.add(sensor_record)
    await db.flush()

    # 3. Update last_seen and GPS position
    worker.last_seen = now
    if gps_valid and latitude is not None and longitude is not None:
        worker.last_lat = latitude
        worker.last_lng = longitude

    # 4. Recompute status
    recent_gas = await get_recent_gas_levels(db, worker_id)
    recent_falls = await get_recent_fall_flags(db, worker_id)
    new_status = compute_status(
        fall_detected=fall_detected,
        recent_fall_flags=recent_falls,
        recent_gas_levels=recent_gas,
        last_seen=previous_last_seen,
        gps_valid=gps_valid,
        latitude=latitude,
        longitude=longitude,
    )
    if new_status == WorkerStatus.FALL and worker.status != WorkerStatus.FALL:
        worker.fall_acknowledged = False
        
    worker.status = new_status
    
    anomaly_predicted = predict_gas_trend_anomaly(recent_gas)

    if accel_x is not None and accel_y is not None and accel_z is not None:
        try:
            worker.activity = predict_activity(accel_x, accel_y, accel_z)
        except Exception as e:
            logger.error("Activity ML Failed: %s", e)

    logger.info(
        "MQTT: Worker %s → status=%s (gas_avg=%.1f fall=%s gps=%s)",
        worker_id,
        new_status.value,
        sum(recent_gas) / len(recent_gas) if recent_gas else 0,
        fall_detected,
        gps_valid,
    )

    # 5. Broadcast to WebSocket clients
    await broadcast_worker_update(worker, sensor_record, anomaly_predicted)


# ---------------------------------------------------------------------------
# Subscriber loop — runs as a background asyncio.Task
# ---------------------------------------------------------------------------

async def run_mqtt_subscriber() -> None:
    """
    Main MQTT subscriber loop.

    Connects to the broker, subscribes to ``helmet/sensor/#``, and processes
    incoming messages indefinitely. Reconnects automatically on disconnect.
    """
    topic = f"{settings.MQTT_TOPIC_PREFIX}/#"
    logger.info(
        "MQTT subscriber starting — broker=%s:%d  topic=%s",
        settings.MQTT_BROKER,
        settings.MQTT_PORT,
        topic,
    )

    async with aiomqtt.Client(
        hostname=settings.MQTT_BROKER,
        port=settings.MQTT_PORT,
        identifier="helmet-backend",
        clean_session=True,
    ) as client:
        logger.info("MQTT subscriber connected to %s:%d", settings.MQTT_BROKER, settings.MQTT_PORT)
        await client.subscribe(topic)
        logger.info("MQTT subscriber subscribed to %s", topic)

        async for message in client.messages:
            raw = message.payload
            if isinstance(raw, (bytes, bytearray)):
                raw = raw.decode()

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("MQTT: Invalid JSON on topic %s: %r", message.topic, raw)
                continue

            try:
                await _handle_message(data)
            except KeyError as exc:
                logger.warning("MQTT: Missing field in payload: %s — %r", exc, data)
            except Exception:
                logger.exception("MQTT: Unhandled error processing message: %r", data)
