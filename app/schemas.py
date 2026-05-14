"""
schemas.py — Pydantic v2 request/response models.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models import AlertEventType, WorkerStatus


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class AdminCreate(BaseModel):
    """Payload to register a new admin."""
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=128)


class AdminOut(BaseModel):
    """Admin info returned after login/register."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    created_at: datetime


class TokenResponse(BaseModel):
    """JWT token envelope."""
    access_token: str
    token_type: str = "bearer"
    admin: AdminOut


# ---------------------------------------------------------------------------
# Worker management schemas
# ---------------------------------------------------------------------------

class WorkerCreate(BaseModel):
    """Payload to register a worker (admin-only)."""
    worker_id: str = Field(..., min_length=1, max_length=50, examples=["W101"])
    name: str = Field(..., min_length=1, max_length=100, examples=["John Doe"])


class WorkerRename(BaseModel):
    """Payload to rename a worker."""
    name: str = Field(..., min_length=1, max_length=100)


# ---------------------------------------------------------------------------
# SensorData schemas
# ---------------------------------------------------------------------------

class SensorDataCreate(BaseModel):
    """Payload sent by an ESP32 device."""

    worker_id: str = Field(..., min_length=1, max_length=50, examples=["W101"])
    gas_level: int = Field(..., ge=0, examples=[220])
    fall_detected: bool = Field(..., examples=[False])
    temperature: float = Field(..., examples=[32.5])
    # GPS fields — optional (not all firmware versions send these)
    latitude: Optional[float] = Field(None, examples=[28.6139])
    longitude: Optional[float] = Field(None, examples=[77.2090])
    gps_valid: bool = Field(False, examples=[True])
    # Accelerometer data for ML
    accel_x: Optional[float] = Field(None, examples=[0.5])
    accel_y: Optional[float] = Field(None, examples=[0.1])
    accel_z: Optional[float] = Field(None, examples=[9.8])


class SensorDataOut(BaseModel):
    """Sensor reading returned to the caller."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    worker_id: str
    timestamp: datetime
    gas_level: int
    fall_detected: bool
    temperature: float
    latitude: Optional[float]
    longitude: Optional[float]
    gps_valid: bool


# ---------------------------------------------------------------------------
# Worker schemas
# ---------------------------------------------------------------------------

class WorkerOut(BaseModel):
    """Full worker status snapshot."""

    model_config = ConfigDict(from_attributes=True)

    worker_id: str
    name: str
    status: WorkerStatus
    last_seen: datetime
    fall_acknowledged: bool
    anomaly_predicted: bool = False
    last_lat: Optional[float] = None
    last_lng: Optional[float] = None
    activity: str = "Unknown"


# ---------------------------------------------------------------------------
# AlertEvent schemas
# ---------------------------------------------------------------------------

class AlertEventOut(BaseModel):
    """Serialised alert history event."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    worker_id: str
    event_type: AlertEventType
    triggered_at: datetime
    acknowledged_at: Optional[datetime]
    gas_level: int


# ---------------------------------------------------------------------------
# Generic response
# ---------------------------------------------------------------------------

class MessageResponse(BaseModel):
    """Simple message envelope."""

    message: str
