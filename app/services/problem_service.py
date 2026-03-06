from typing import List

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.problem import Problem
from app.schemas.problem import ProblemCreate, ProblemUpdate


async def get_all(db: AsyncSession) -> List[Problem]:
    result = await db.execute(select(Problem))
    return result.scalars().all()


async def get_by_id(db: AsyncSession, problem_id: int) -> Problem:
    result = await db.execute(select(Problem).where(Problem.id == problem_id))
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem


async def create(db: AsyncSession, payload: ProblemCreate) -> Problem:
    problem = Problem(**payload.model_dump())
    db.add(problem)
    await db.commit()
    await db.refresh(problem)
    return problem


async def update(db: AsyncSession, problem_id: int, payload: ProblemUpdate) -> Problem:
    problem = await get_by_id(db, problem_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(problem, field, value)
    await db.commit()
    await db.refresh(problem)
    return problem


async def delete(db: AsyncSession, problem_id: int) -> None:
    problem = await get_by_id(db, problem_id)
    await db.delete(problem)
    await db.commit()
