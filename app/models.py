"""
models.py — SQLAlchemy ORM models for the Industrial Safety Monitoring System.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class WorkerStatus(str, enum.Enum):
    SAFE = "SAFE"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    FALL = "FALL"
    INACTIVE = "INACTIVE"
    GEO_VIOLATION = "GEO_VIOLATION"


class AlertEventType(str, enum.Enum):
    FALL = "FALL"
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    GEO_VIOLATION = "GEO_VIOLATION"


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationship — one admin, many workers
    workers: Mapped[list["Worker"]] = relationship(
        "Worker",
        back_populates="admin",
        lazy="select",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Admin id={self.id} username={self.username!r}>"


# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------

class Worker(Base):
    __tablename__ = "workers"

    worker_id: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="Unknown")
    status: Mapped[WorkerStatus] = mapped_column(
        Enum(WorkerStatus, name="workerstatus"),
        nullable=False,
        default=WorkerStatus.INACTIVE,
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    fall_acknowledged: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # GPS — last known valid position
    last_lat: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    last_lng: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)

    # Admin ownership (nullable — workers registered before auth still work)
    admin_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("admins.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Activity Prediction ML
    activity: Mapped[str] = mapped_column(String(50), default="Unknown")

    # Relationships
    admin: Mapped["Admin | None"] = relationship("Admin", back_populates="workers")
    sensor_readings: Mapped[list["SensorData"]] = relationship(
        "SensorData",
        back_populates="worker",
        cascade="all, delete-orphan",
        lazy="select",
    )
    alert_events: Mapped[list["AlertEvent"]] = relationship(
        "AlertEvent",
        back_populates="worker",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Worker id={self.worker_id!r} status={self.status}>"


# ---------------------------------------------------------------------------
# SensorData
# ---------------------------------------------------------------------------

class SensorData(Base):
    __tablename__ = "sensor_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    worker_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("workers.worker_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    gas_level: Mapped[int] = mapped_column(Integer, nullable=False)
    fall_detected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    temperature: Mapped[float] = mapped_column(Float, nullable=False)

    # GPS fields
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    gps_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationship back to worker
    worker: Mapped["Worker"] = relationship("Worker", back_populates="sensor_readings")

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<SensorData id={self.id} worker={self.worker_id!r} "
            f"gas={self.gas_level} fall={self.fall_detected} "
            f"gps={'valid' if self.gps_valid else 'invalid'}>"
        )


# ---------------------------------------------------------------------------
# AlertEvent
# ---------------------------------------------------------------------------

class AlertEvent(Base):
    """Records every hazard event for history & acknowledgement tracking."""

    __tablename__ = "alert_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    worker_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("workers.worker_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[AlertEventType] = mapped_column(
        Enum(AlertEventType, name="alerteventtype"),
        nullable=False,
    )
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    gas_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationship back to worker
    worker: Mapped["Worker"] = relationship("Worker", back_populates="alert_events")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AlertEvent id={self.id} worker={self.worker_id!r} type={self.event_type}>"
