"""
geofence.py — GET/POST for Safe Zone configuration using a local JSON file.
"""

import json
import os
import logging
from pydantic import BaseModel
from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Geofence"])

GEO_FILE = "geofence.json"

class GeofenceConfig(BaseModel):
    lat: float
    lng: float
    radius: float
    enabled: bool

def load_geofence() -> GeofenceConfig | None:
    if not os.path.exists(GEO_FILE):
        return None
    try:
        with open(GEO_FILE, "r") as f:
            data = json.load(f)
            return GeofenceConfig(**data)
    except Exception as e:
        logger.error(f"Failed to load geofence.json: {e}")
        return None

@router.get("/geofence", response_model=GeofenceConfig, summary="Get Safe Zone configuration")
def get_geofence():
    gf = load_geofence()
    if gf:
        return gf
    return GeofenceConfig(lat=0.0, lng=0.0, radius=50.0, enabled=False)

@router.post("/geofence", response_model=GeofenceConfig, summary="Set Safe Zone configuration")
def set_geofence(config: GeofenceConfig):
    # Save the configuration to local JSON file for lightweight persistence
    with open(GEO_FILE, "w") as f:
        json.dump(config.model_dump(), f)
    logger.info(f"Geofence updated: {config.model_dump()}")
    return config
