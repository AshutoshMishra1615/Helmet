"""
deps.py — Shared FastAPI dependencies.

get_current_admin: validates a Bearer JWT and returns the Admin ORM object.
"""

import logging
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Admin

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


async def get_current_admin(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: AsyncSession = Depends(get_db),
) -> Admin:
    """Validate JWT bearer token and return the authenticated Admin."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise credentials_exception

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        admin_id: int | None = payload.get("sub")
        if admin_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(Admin).where(Admin.id == int(admin_id)))
    admin = result.scalar_one_or_none()
    if admin is None:
        raise credentials_exception

    return admin
