"""
alert_logic.py — Safety status determination logic.

Rules (in priority order):
  1. FALL     → fall_detected is True
  2. CRITICAL → rolling average of last 5 gas readings > 300
  3. WARNING  → rolling average of last 5 gas readings > 200
  4. INACTIVE → last_seen more than 30 seconds ago
  5. SAFE     → none of the above
"""

import logging
import math
from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SensorData, WorkerStatus
from app.routes.geofence import load_geofence

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GAS_WINDOW_SIZE: int = 15  # Increased to 15 to feed the ML predictor
GAS_CRITICAL_THRESHOLD: int = 300
GAS_WARNING_THRESHOLD: int = 200
INACTIVE_TIMEOUT_SECONDS: int = 30


# ---------------------------------------------------------------------------
# Data fetcher
# ---------------------------------------------------------------------------

async def get_recent_gas_levels(
    db: AsyncSession,
    worker_id: str,
    n: int = GAS_WINDOW_SIZE,
) -> list[int]:
    """Fetch the last *n* gas_level readings for a worker, newest-first."""
    result = await db.execute(
        select(SensorData.gas_level)
        .where(SensorData.worker_id == worker_id)
        .order_by(desc(SensorData.timestamp))
        .limit(n)
    )
    rows = result.scalars().all()
    logger.debug("Gas levels for worker %s (last %d): %s", worker_id, n, rows)
    return list(rows)


FALL_CONFIRM_WINDOW: int = 3      # look at the last N readings
FALL_CONFIRM_THRESHOLD: int = 2   # at least this many must be fall_detected


async def get_recent_fall_flags(
    db: AsyncSession,
    worker_id: str,
    n: int = FALL_CONFIRM_WINDOW,
) -> list[bool]:
    """Fetch the last *n* fall_detected flags for a worker, newest-first."""
    result = await db.execute(
        select(SensorData.fall_detected)
        .where(SensorData.worker_id == worker_id)
        .order_by(desc(SensorData.timestamp))
        .limit(n)
    )
    rows = result.scalars().all()
    logger.debug("Fall flags for worker %s (last %d): %s", worker_id, n, rows)
    return list(rows)


# ---------------------------------------------------------------------------
# Rolling average helper
# ---------------------------------------------------------------------------

def _rolling_average(values: list[int]) -> float:
    """Return the average of *values*, or 0.0 if the list is empty."""
    if not values:
        return 0.0
    return sum(values) / len(values)


# ---------------------------------------------------------------------------
# Geofence Math Helper
# ---------------------------------------------------------------------------

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance in meters between two points on the earth."""
    R = 6371000  # radius of Earth in meters
    phi_1 = math.radians(lat1)
    phi_2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi_1) * math.cos(phi_2) * \
        math.sin(delta_lambda / 2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# ---------------------------------------------------------------------------
# Status computation
# ---------------------------------------------------------------------------

def compute_status(
    *,
    fall_detected: bool,
    recent_fall_flags: list[bool],
    recent_gas_levels: list[int],
    last_seen: datetime,
    gps_valid: bool = False,
    latitude: float | None = None,
    longitude: float | None = None,
) -> WorkerStatus:
    """
    Determine the current WorkerStatus using the priority-ordered rule set.

    Parameters
    ----------
    fall_detected:
        True when the current sensor reading reports a fall.
    recent_fall_flags:
        List of the last N fall_detected booleans (newest-first),
        used to confirm a sustained fall (not a transient bump).
    recent_gas_levels:
        List of the last N gas level readings (most recent first).
    last_seen:
        The *previous* last_seen timestamp before this update.
    """

    # Rule 1 — Fall: require at least FALL_CONFIRM_THRESHOLD of the last
    #          FALL_CONFIRM_WINDOW readings to be fall_detected
    if fall_detected:
        confirmed_count = sum(1 for f in recent_fall_flags if f)
        if confirmed_count >= FALL_CONFIRM_THRESHOLD:
            logger.info(
                "Status → FALL (confirmed: %d/%d readings)",
                confirmed_count, len(recent_fall_flags),
            )
            return WorkerStatus.FALL
        else:
            logger.info(
                "Fall flagged but NOT confirmed (%d/%d < %d) — treating as transient bump",
                confirmed_count, len(recent_fall_flags), FALL_CONFIRM_THRESHOLD,
            )

    # Rule 2 & 3 — Rolling gas average (only use the 5 most recent for deterministic rule)
    avg_gas = _rolling_average(recent_gas_levels[:5])
    logger.debug("Rolling gas average (n=5): %.1f", avg_gas)

    if avg_gas > GAS_CRITICAL_THRESHOLD:
        logger.info("Status → CRITICAL (avg gas %.1f > %d)", avg_gas, GAS_CRITICAL_THRESHOLD)
        return WorkerStatus.CRITICAL

    # Rule 3 — Geofence Violation
    if gps_valid and latitude is not None and longitude is not None:
        gf = load_geofence()
        if gf and gf.enabled:
            dist = haversine_distance(latitude, longitude, gf.lat, gf.lng)
            if dist > gf.radius:
                logger.warning("Status → GEO_VIOLATION (dist %.1fm > %.1fm)", dist, gf.radius)
                return WorkerStatus.GEO_VIOLATION

    if avg_gas > GAS_WARNING_THRESHOLD:
        logger.info("Status → WARNING (avg gas %.1f > %d)", avg_gas, GAS_WARNING_THRESHOLD)
        return WorkerStatus.WARNING

    # Rule 4 — Inactivity (last_seen is the time *before* this reading arrived)
    now = datetime.now(timezone.utc)
    # Ensure last_seen is tz-aware for comparison
    ls = last_seen if last_seen.tzinfo is not None else last_seen.replace(tzinfo=timezone.utc)
    seconds_since = (now - ls).total_seconds()

    if seconds_since > INACTIVE_TIMEOUT_SECONDS:
        logger.info("Status → INACTIVE (last seen %.0fs ago)", seconds_since)
        return WorkerStatus.INACTIVE

    # Rule 5 — All clear
    logger.info("Status → SAFE")
    return WorkerStatus.SAFE
