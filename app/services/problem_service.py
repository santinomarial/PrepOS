from datetime import date
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.problem import Problem
from app.schemas.problem import ProblemCreate, ProblemUpdate

_WITH_ATTEMPTS = selectinload(Problem.attempts)


async def get_all(
    db: AsyncSession,
    user_id: int,
    topic: Optional[str] = None,
    difficulty: Optional[str] = None,
    tag: Optional[str] = None,
) -> List[Problem]:
    query = select(Problem).options(_WITH_ATTEMPTS).where(Problem.user_id == user_id)
    if topic:
        query = query.where(Problem.topic == topic)
    if difficulty:
        query = query.where(Problem.difficulty == difficulty)
    if tag:
        query = query.where(Problem.tags.ilike(f"%{tag}%"))
    result = await db.execute(query)
    return result.scalars().all()


async def get_by_id(db: AsyncSession, problem_id: int, user_id: int) -> Problem:
    """Return the problem only if it exists AND belongs to user_id.

    Returning 404 for both "not found" and "wrong owner" avoids leaking
    information about other users' data.
    """
    result = await db.execute(
        select(Problem)
        .options(_WITH_ATTEMPTS)
        .where(Problem.id == problem_id, Problem.user_id == user_id)
    )
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem


async def create(db: AsyncSession, payload: ProblemCreate, user_id: int) -> Problem:
    problem = Problem(**payload.model_dump(), user_id=user_id)
    db.add(problem)
    await db.commit()
    await db.refresh(problem)
    return problem


async def update(
    db: AsyncSession, problem_id: int, payload: ProblemUpdate, user_id: int
) -> Problem:
    problem = await get_by_id(db, problem_id, user_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(problem, field, value)
    await db.commit()
    await db.refresh(problem)
    return problem


async def delete(db: AsyncSession, problem_id: int, user_id: int) -> None:
    problem = await get_by_id(db, problem_id, user_id)
    await db.delete(problem)
    await db.commit()


async def get_due(db: AsyncSession, user_id: int) -> List[Problem]:
    """Return all problems due for review today, sorted by priority_score descending."""
    from app.services.scheduler import AttemptRecord, schedule

    problems = await get_all(db, user_id)
    today = date.today()

    scored: list[tuple[Problem, float]] = []
    for p in problems:
        records = [
            AttemptRecord(
                solved=a.solved,
                time_to_solve_minutes=a.time_to_solve_minutes,
                attempted_at=a.attempted_at,
            )
            for a in p.attempts
        ]
        result = schedule(records, difficulty=p.difficulty)
        if result.next_review_date <= today:
            scored.append((p, result.priority_score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [p for p, _ in scored]
