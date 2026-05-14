"""
sensor.py — POST /sensor-data

Ingests a sensor reading from an ESP32 device, updates the worker record,
recomputes the safety status, and broadcasts the updated status via WebSocket.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AlertEvent, AlertEventType, SensorData, Worker, WorkerStatus
from app.routes.websocket import broadcast_worker_update
from app.schemas import SensorDataCreate, SensorDataOut
from app.services.alert_logic import compute_status, get_recent_gas_levels, get_recent_fall_flags
from app.services.ml_activity import predict_activity
from app.services.ml_predictor import predict_gas_trend_anomaly

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Sensor"])


@router.post(
    "/sensor-data",
    response_model=SensorDataOut,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest sensor reading from an ESP32 device",
)
async def ingest_sensor_data(
    payload: SensorDataCreate,
    db: AsyncSession = Depends(get_db),
) -> SensorDataOut:
    """
    Accept a sensor reading, persist it, update the worker's status, and
    broadcast the new status to all connected WebSocket clients.
    """

    # ------------------------------------------------------------------
    # 1. Upsert Worker — create if not seen before
    # ------------------------------------------------------------------
    result = await db.execute(
        select(Worker).where(Worker.worker_id == payload.worker_id)
    )
    worker: Worker | None = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if worker is None:
        logger.info("New worker detected: %s — creating record.", payload.worker_id)
        worker = Worker(
            worker_id=payload.worker_id,
            name=payload.worker_id,   # default name = ID until explicitly named
            status=WorkerStatus.INACTIVE,
            last_seen=now,
            fall_acknowledged=False,
        )
        db.add(worker)
        await db.flush()  # assign PK without committing

    previous_last_seen = worker.last_seen

    # ------------------------------------------------------------------
    # 2. Persist the sensor reading (with GPS)
    # ------------------------------------------------------------------
    sensor_record = SensorData(
        worker_id=payload.worker_id,
        timestamp=now,
        gas_level=payload.gas_level,
        fall_detected=payload.fall_detected,
        temperature=payload.temperature,
        latitude=payload.latitude,
        longitude=payload.longitude,
        gps_valid=payload.gps_valid,
    )
    db.add(sensor_record)
    await db.flush()

    logger.debug(
        "Stored SensorData id=%d for worker=%s (gps_valid=%s)",
        sensor_record.id, payload.worker_id, payload.gps_valid,
    )

    # ------------------------------------------------------------------
    # 3. Update worker.last_seen and GPS position
    # ------------------------------------------------------------------
    worker.last_seen = now
    if payload.gps_valid and payload.latitude is not None and payload.longitude is not None:
        worker.last_lat = payload.latitude
        worker.last_lng = payload.longitude

    # ------------------------------------------------------------------
    # 4. Recompute safety status using rolling gas average
    # ------------------------------------------------------------------
    recent_gas = await get_recent_gas_levels(db, payload.worker_id)
    recent_falls = await get_recent_fall_flags(db, payload.worker_id)

    new_status = compute_status(
        fall_detected=payload.fall_detected,
        recent_fall_flags=recent_falls,
        recent_gas_levels=recent_gas,
        last_seen=previous_last_seen,
        gps_valid=payload.gps_valid,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )

    # 4b. Predict ML gas trend anomaly
    anomaly_predicted = predict_gas_trend_anomaly(recent_gas)

    # 4c. Predict ML Activity
    if payload.accel_x is not None and payload.accel_y is not None and payload.accel_z is not None:
        try:
            worker.activity = predict_activity(payload.accel_x, payload.accel_y, payload.accel_z)
        except Exception as e:
            logger.error("Activity ML Failed: %s", e)

    if new_status == WorkerStatus.FALL and worker.status != WorkerStatus.FALL:
        worker.fall_acknowledged = False

    worker.status = new_status

    logger.info(
        "Worker %s → status=%s (gas_avg=%.1f fall=%s gps=%s)",
        payload.worker_id,
        new_status.value,
        sum(recent_gas) / len(recent_gas) if recent_gas else 0,
        payload.fall_detected,
        payload.gps_valid,
    )

    # ------------------------------------------------------------------
    # 5. Record an AlertEvent for significant status changes
    # ------------------------------------------------------------------
    alert_event_map = {
        WorkerStatus.FALL: AlertEventType.FALL,
        WorkerStatus.CRITICAL: AlertEventType.CRITICAL,
        WorkerStatus.GEO_VIOLATION: AlertEventType.GEO_VIOLATION,
        WorkerStatus.WARNING: AlertEventType.WARNING,
    }
    if new_status in alert_event_map:
        alert_event = AlertEvent(
            worker_id=payload.worker_id,
            event_type=alert_event_map[new_status],
            triggered_at=now,
            gas_level=payload.gas_level,
        )
        db.add(alert_event)

    await db.flush()

    # ------------------------------------------------------------------
    # 7. Broadcast updated worker to WebSocket clients
    # ------------------------------------------------------------------
    await broadcast_worker_update(worker, sensor_record, anomaly_predicted)

    return SensorDataOut.model_validate(sensor_record)
