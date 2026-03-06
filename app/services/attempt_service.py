from typing import List

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import Attempt
from app.schemas.attempt import AttemptCreate, AttemptUpdate


async def get_all(db: AsyncSession) -> List[Attempt]:
    result = await db.execute(select(Attempt))
    return result.scalars().all()


async def get_by_id(db: AsyncSession, attempt_id: int) -> Attempt:
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return attempt


async def create(db: AsyncSession, payload: AttemptCreate) -> Attempt:
    attempt = Attempt(**payload.model_dump())
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return attempt


async def update(db: AsyncSession, attempt_id: int, payload: AttemptUpdate) -> Attempt:
    attempt = await get_by_id(db, attempt_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(attempt, field, value)
    await db.commit()
    await db.refresh(attempt)
    return attempt


async def delete(db: AsyncSession, attempt_id: int) -> None:
    attempt = await get_by_id(db, attempt_id)
    await db.delete(attempt)
    await db.commit()
