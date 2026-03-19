from typing import List

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import Attempt
from app.models.problem import Problem
from app.schemas.attempt import AttemptCreate, AttemptCreateBody, AttemptUpdate


async def get_all(db: AsyncSession, user_id: int) -> List[Attempt]:
    """Return all attempts that belong to the user (via the problem join)."""
    result = await db.execute(
        select(Attempt)
        .join(Problem, Attempt.problem_id == Problem.id)
        .where(Problem.user_id == user_id)
    )
    return result.scalars().all()


async def get_by_id(db: AsyncSession, attempt_id: int, user_id: int) -> Attempt:
    """Return the attempt only if it exists and its problem belongs to user_id.

    Returns 404 for both "not found" and "wrong owner" to avoid information leaks.
    """
    result = await db.execute(
        select(Attempt)
        .join(Problem, Attempt.problem_id == Problem.id)
        .where(Attempt.id == attempt_id, Problem.user_id == user_id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return attempt


async def get_by_problem_id(db: AsyncSession, problem_id: int) -> List[Attempt]:
    """Return attempts for a problem, newest first.

    The caller is responsible for verifying the problem belongs to the current
    user before calling this function.
    """
    result = await db.execute(
        select(Attempt)
        .where(Attempt.problem_id == problem_id)
        .order_by(Attempt.attempted_at.desc())
    )
    return result.scalars().all()


async def create(db: AsyncSession, payload: AttemptCreate, user_id: int) -> Attempt:
    """Create an attempt via the flat route.  Verifies problem ownership first."""
    prob = await db.execute(
        select(Problem).where(
            Problem.id == payload.problem_id, Problem.user_id == user_id
        )
    )
    if not prob.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Problem not found")

    attempt = Attempt(**payload.model_dump())
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return attempt


async def create_for_problem(
    db: AsyncSession, problem_id: int, payload: AttemptCreateBody
) -> Attempt:
    """Create an attempt via the nested route.

    The caller (router) must have already verified problem ownership by calling
    problem_service.get_by_id before reaching this function.
    """
    data = payload.model_dump(exclude_unset=True)
    attempt = Attempt(problem_id=problem_id, **data)
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return attempt


async def update(db: AsyncSession, attempt_id: int, payload: AttemptUpdate, user_id: int) -> Attempt:
    attempt = await get_by_id(db, attempt_id, user_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(attempt, field, value)
    await db.commit()
    await db.refresh(attempt)
    return attempt


async def delete(db: AsyncSession, attempt_id: int, user_id: int) -> None:
    attempt = await get_by_id(db, attempt_id, user_id)
    await db.delete(attempt)
    await db.commit()
