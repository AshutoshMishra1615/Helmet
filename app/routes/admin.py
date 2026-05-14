"""
admin.py — Admin-protected worker management endpoints.

POST   /admin/workers              → register a new worker
PUT    /admin/workers/{id}/name    → rename a worker
DELETE /admin/workers/{id}         → delete a worker
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Admin, Worker, WorkerStatus
from app.routes.deps import get_current_admin
from app.schemas import MessageResponse, WorkerCreate, WorkerOut, WorkerRename

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ---------------------------------------------------------------------------
# POST /admin/workers — register a new worker
# ---------------------------------------------------------------------------

@router.post(
    "/workers",
    response_model=WorkerOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new worker (admin-only)",
)
async def register_worker(
    payload: WorkerCreate,
    current_admin: Annotated[Admin, Depends(get_current_admin)],
    db: AsyncSession = Depends(get_db),
) -> WorkerOut:
    """Creates a named worker entry ready to receive sensor data."""
    existing = await db.execute(select(Worker).where(Worker.worker_id == payload.worker_id))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Worker '{payload.worker_id}' already exists.",
        )

    worker = Worker(
        worker_id=payload.worker_id,
        name=payload.name,
        status=WorkerStatus.INACTIVE,
        fall_acknowledged=False,
        admin_id=current_admin.id,
    )
    db.add(worker)
    await db.flush()
    await db.refresh(worker)

    logger.info(
        "Admin %s registered worker id=%s name=%s",
        current_admin.username, worker.worker_id, worker.name,
    )
    return WorkerOut.model_validate(worker)


# ---------------------------------------------------------------------------
# PUT /admin/workers/{id}/name — rename a worker
# ---------------------------------------------------------------------------

@router.put(
    "/workers/{worker_id}/name",
    response_model=WorkerOut,
    summary="Rename a worker (admin-only)",
)
async def rename_worker(
    worker_id: str,
    payload: WorkerRename,
    current_admin: Annotated[Admin, Depends(get_current_admin)],
    db: AsyncSession = Depends(get_db),
) -> WorkerOut:
    result = await db.execute(select(Worker).where(Worker.worker_id == worker_id))
    worker = result.scalar_one_or_none()
    if worker is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found.")

    worker.name = payload.name
    await db.flush()
    await db.refresh(worker)
    logger.info("Admin %s renamed worker %s → %s", current_admin.username, worker_id, payload.name)
    return WorkerOut.model_validate(worker)


# ---------------------------------------------------------------------------
# DELETE /admin/workers/{id} — delete a worker
# ---------------------------------------------------------------------------

@router.delete(
    "/workers/{worker_id}",
    response_model=MessageResponse,
    summary="Delete a worker and all their data (admin-only)",
)
async def delete_worker(
    worker_id: str,
    current_admin: Annotated[Admin, Depends(get_current_admin)],
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    result = await db.execute(select(Worker).where(Worker.worker_id == worker_id))
    worker = result.scalar_one_or_none()
    if worker is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found.")

    await db.delete(worker)
    await db.flush()
    logger.info("Admin %s deleted worker %s", current_admin.username, worker_id)
    return MessageResponse(message=f"Worker '{worker_id}' deleted successfully.")
