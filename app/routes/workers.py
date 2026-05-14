"""
workers.py — Worker query endpoints.

GET /workers               → all workers
GET /alerts                → workers in an alert state
GET /worker/{id}/history   → time-series sensor readings for one worker
GET /worker/{id}/latest-sensor → most recent sensor reading
POST /worker/{id}/acknowledge-fall → mark fall as acknowledged
GET /alert-events          → recent alert history across all workers
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AlertEvent, SensorData, Worker, WorkerStatus
from app.schemas import AlertEventOut, MessageResponse, SensorDataOut, WorkerOut

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Workers"])

# Statuses that count as an active alert
ALERT_STATUSES = {
    WorkerStatus.FALL,
    WorkerStatus.CRITICAL,
    WorkerStatus.WARNING,
    WorkerStatus.INACTIVE,
}


# ---------------------------------------------------------------------------
# GET /workers
# ---------------------------------------------------------------------------

@router.get(
    "/workers",
    response_model=list[WorkerOut],
    summary="List all workers with their current safety status",
)
async def list_workers(
    db: AsyncSession = Depends(get_db),
) -> list[WorkerOut]:
    """Return every worker currently registered in the system."""
    result = await db.execute(select(Worker).order_by(Worker.worker_id))
    workers = result.scalars().all()
    logger.debug("Returning %d workers.", len(workers))
    return [WorkerOut.model_validate(w) for w in workers]


# ---------------------------------------------------------------------------
# GET /alerts
# ---------------------------------------------------------------------------

@router.get(
    "/alerts",
    response_model=list[WorkerOut],
    summary="List workers currently in an alert state (WARNING / CRITICAL / FALL / INACTIVE)",
)
async def list_alerts(
    db: AsyncSession = Depends(get_db),
) -> list[WorkerOut]:
    """Return workers whose status requires attention."""
    result = await db.execute(
        select(Worker)
        .where(Worker.status.in_(ALERT_STATUSES))
        .order_by(Worker.status, Worker.worker_id)
    )
    workers = result.scalars().all()
    logger.debug("Alert workers: %d", len(workers))
    return [WorkerOut.model_validate(w) for w in workers]


# ---------------------------------------------------------------------------
# GET /worker/{id}/history
# ---------------------------------------------------------------------------

@router.get(
    "/worker/{worker_id}/history",
    response_model=list[SensorDataOut],
    summary="Retrieve recent sensor readings for a specific worker",
)
async def worker_history(
    worker_id: str,
    limit: int = Query(default=20, ge=1, le=500, description="Number of readings to return"),
    db: AsyncSession = Depends(get_db),
) -> list[SensorDataOut]:
    """
    Return the last *limit* sensor readings for *worker_id*, ordered
    newest-first (time-series descending).
    """
    # Verify worker exists
    worker_result = await db.execute(
        select(Worker).where(Worker.worker_id == worker_id)
    )
    worker = worker_result.scalar_one_or_none()
    if worker is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Worker '{worker_id}' not found.",
        )

    result = await db.execute(
        select(SensorData)
        .where(SensorData.worker_id == worker_id)
        .order_by(desc(SensorData.timestamp))
        .limit(limit)
    )
    readings = result.scalars().all()
    logger.debug(
        "Returning %d history readings for worker=%s (limit=%d).",
        len(readings),
        worker_id,
        limit,
    )
    return [SensorDataOut.model_validate(r) for r in readings]


# ---------------------------------------------------------------------------
# GET /worker/{id}/latest-sensor
# ---------------------------------------------------------------------------

@router.get(
    "/worker/{worker_id}/latest-sensor",
    response_model=SensorDataOut,
    summary="Retrieve the most recent sensor reading for a worker",
)
async def latest_sensor(
    worker_id: str,
    db: AsyncSession = Depends(get_db),
) -> SensorDataOut:
    """Return the single most recent sensor reading for *worker_id*."""
    worker_result = await db.execute(
        select(Worker).where(Worker.worker_id == worker_id)
    )
    if worker_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Worker '{worker_id}' not found.",
        )

    result = await db.execute(
        select(SensorData)
        .where(SensorData.worker_id == worker_id)
        .order_by(desc(SensorData.timestamp))
        .limit(1)
    )
    reading = result.scalar_one_or_none()
    if reading is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No sensor data found for worker '{worker_id}'.",
        )
    return SensorDataOut.model_validate(reading)


# ---------------------------------------------------------------------------
# POST /worker/{id}/acknowledge-fall
# ---------------------------------------------------------------------------

@router.post(
    "/worker/{worker_id}/acknowledge-fall",
    response_model=MessageResponse,
    summary="Acknowledge a fall alert — marks it as reviewed by a supervisor",
)
async def acknowledge_fall(
    worker_id: str,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Mark the worker's fall alert as acknowledged.
    Sets `fall_acknowledged = True` and stamps the latest open AlertEvent.
    """
    worker_result = await db.execute(
        select(Worker).where(Worker.worker_id == worker_id)
    )
    worker = worker_result.scalar_one_or_none()
    if worker is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Worker '{worker_id}' not found.",
        )

    worker.fall_acknowledged = True

    # Stamp the most recent unacknowledged FALL alert event
    now = datetime.now(timezone.utc)
    event_result = await db.execute(
        select(AlertEvent)
        .where(
            AlertEvent.worker_id == worker_id,
            AlertEvent.acknowledged_at.is_(None),
        )
        .order_by(desc(AlertEvent.triggered_at))
        .limit(1)
    )
    event = event_result.scalar_one_or_none()
    if event:
        event.acknowledged_at = now

    await db.flush()
    logger.info("Fall acknowledged for worker %s.", worker_id)
    return MessageResponse(message=f"Fall alert for worker '{worker_id}' acknowledged.")


# ---------------------------------------------------------------------------
# GET /alert-events
# ---------------------------------------------------------------------------

@router.get(
    "/alert-events",
    response_model=list[AlertEventOut],
    summary="Return recent alert history events across all workers",
)
async def list_alert_events(
    limit: int = Query(default=50, ge=1, le=200, description="Number of events to return"),
    db: AsyncSession = Depends(get_db),
) -> list[AlertEventOut]:
    """Return the last *limit* alert events, newest first."""
    result = await db.execute(
        select(AlertEvent)
        .order_by(desc(AlertEvent.triggered_at))
        .limit(limit)
    )
    events = result.scalars().all()
    return [AlertEventOut.model_validate(e) for e in events]
