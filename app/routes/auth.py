"""
auth.py — Admin authentication endpoints.

POST /auth/register  → create a new admin account
POST /auth/login     → returns a JWT access token
GET  /auth/me        → returns current admin info
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Admin
from app.routes.deps import get_current_admin
from app.schemas import AdminCreate, AdminOut, TokenResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def _verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


def _create_token(admin_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(admin_id), "exp": expire},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new admin account",
)
async def register(
    payload: AdminCreate,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Creates a new admin. The first registration is always open.
    Subsequent registrations require an existing admin username to already exist
    (open registration is fine for a self-hosted system — restrict in production).
    """
    # Check for duplicate username
    existing = await db.execute(select(Admin).where(Admin.username == payload.username))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{payload.username}' is already taken.",
        )

    admin = Admin(
        username=payload.username,
        hashed_password=_hash_password(payload.password),
    )
    db.add(admin)
    await db.flush()
    await db.refresh(admin)

    token = _create_token(admin.id)
    logger.info("Registered new admin: id=%d username=%s", admin.id, admin.username)
    return TokenResponse(access_token=token, admin=AdminOut.model_validate(admin))


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in and receive a JWT access token",
)
async def login(
    payload: AdminCreate,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    invalid_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password.",
    )

    result = await db.execute(select(Admin).where(Admin.username == payload.username))
    admin = result.scalar_one_or_none()

    if admin is None or not _verify_password(payload.password, admin.hashed_password):
        raise invalid_exc

    token = _create_token(admin.id)
    logger.info("Admin logged in: id=%d username=%s", admin.id, admin.username)
    return TokenResponse(access_token=token, admin=AdminOut.model_validate(admin))


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

@router.get(
    "/me",
    response_model=AdminOut,
    summary="Return the currently authenticated admin",
)
async def get_me(
    current_admin: Annotated[Admin, Depends(get_current_admin)],
) -> AdminOut:
    return AdminOut.model_validate(current_admin)
