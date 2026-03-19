from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.attempt import AttemptCreate, AttemptRead, AttemptUpdate
from app.services import attempt_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/attempts", tags=["attempts"])


@router.get("/", response_model=List[AttemptRead])
async def list_attempts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await attempt_service.get_all(db, current_user.id)


@router.get("/{attempt_id}", response_model=AttemptRead)
async def get_attempt(
    attempt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await attempt_service.get_by_id(db, attempt_id, current_user.id)


@router.post("/", response_model=AttemptRead, status_code=201)
async def create_attempt(
    payload: AttemptCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await attempt_service.create(db, payload, current_user.id)


@router.patch("/{attempt_id}", response_model=AttemptRead)
async def update_attempt(
    attempt_id: int,
    payload: AttemptUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await attempt_service.update(db, attempt_id, payload, current_user.id)


@router.delete("/{attempt_id}", status_code=204)
async def delete_attempt(
    attempt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await attempt_service.delete(db, attempt_id, current_user.id)
