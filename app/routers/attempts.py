from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.attempt import AttemptCreate, AttemptRead, AttemptUpdate
from app.services import attempt_service

router = APIRouter(prefix="/attempts", tags=["attempts"])


@router.get("/", response_model=List[AttemptRead])
async def list_attempts(db: AsyncSession = Depends(get_db)):
    return await attempt_service.get_all(db)


@router.get("/{attempt_id}", response_model=AttemptRead)
async def get_attempt(attempt_id: int, db: AsyncSession = Depends(get_db)):
    return await attempt_service.get_by_id(db, attempt_id)


@router.post("/", response_model=AttemptRead, status_code=201)
async def create_attempt(payload: AttemptCreate, db: AsyncSession = Depends(get_db)):
    return await attempt_service.create(db, payload)


@router.patch("/{attempt_id}", response_model=AttemptRead)
async def update_attempt(
    attempt_id: int, payload: AttemptUpdate, db: AsyncSession = Depends(get_db)
):
    return await attempt_service.update(db, attempt_id, payload)


@router.delete("/{attempt_id}", status_code=204)
async def delete_attempt(attempt_id: int, db: AsyncSession = Depends(get_db)):
    await attempt_service.delete(db, attempt_id)
