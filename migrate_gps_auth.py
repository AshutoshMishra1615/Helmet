"""
migrate_gps_auth.py — One-time migration script.

Run this script ONCE to add new columns to existing tables:
  - workers: last_lat, last_lng, admin_id
  - sensor_data: latitude, longitude, gps_valid

New tables (admins) are created automatically by init_db() via SQLAlchemy create_all.

Usage:
    python migrate_gps_auth.py
"""

import asyncio
import logging

import asyncpg

# Read DATABASE_URL from .env
from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


async def run_migration() -> None:
    # Convert SQLAlchemy async URL to plain asyncpg URL
    raw_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

    logger.info("Connecting to database …")
    conn = await asyncpg.connect(raw_url)

    migrations = [
        # Create admins table (if not exists)
        """
        CREATE TABLE IF NOT EXISTS admins (
            id SERIAL PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,

        # Add admin_id FK to workers
        """
        ALTER TABLE workers
            ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL
        """,

        # Add GPS columns to workers
        "ALTER TABLE workers ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION",
        "ALTER TABLE workers ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION",

        # Add GPS columns to sensor_data
        "ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION",
        "ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION",
        "ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS gps_valid BOOLEAN NOT NULL DEFAULT FALSE",

        # Add fall_acknowledged to workers
        "ALTER TABLE workers ADD COLUMN IF NOT EXISTS fall_acknowledged BOOLEAN NOT NULL DEFAULT FALSE",
    ]

    for sql in migrations:
        sql_display = sql.strip().split("\n")[0][:80]
        logger.info("Executing: %s …", sql_display)
        try:
            await conn.execute(sql.strip())
            logger.info("  ✓ OK")
        except Exception as e:
            logger.error("  ✗ FAILED: %s", e)

    await conn.close()
    logger.info("Migration complete.")


if __name__ == "__main__":
    asyncio.run(run_migration())
