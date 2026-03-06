from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.problem import ProblemCreate, ProblemRead, ProblemUpdate
from app.services import problem_service

router = APIRouter(prefix="/problems", tags=["problems"])


@router.get("/", response_model=List[ProblemRead])
async def list_problems(db: AsyncSession = Depends(get_db)):
    return await problem_service.get_all(db)


@router.get("/{problem_id}", response_model=ProblemRead)
async def get_problem(problem_id: int, db: AsyncSession = Depends(get_db)):
    return await problem_service.get_by_id(db, problem_id)


@router.post("/", response_model=ProblemRead, status_code=201)
async def create_problem(payload: ProblemCreate, db: AsyncSession = Depends(get_db)):
    return await problem_service.create(db, payload)


@router.patch("/{problem_id}", response_model=ProblemRead)
async def update_problem(
    problem_id: int, payload: ProblemUpdate, db: AsyncSession = Depends(get_db)
):
    return await problem_service.update(db, problem_id, payload)


@router.delete("/{problem_id}", status_code=204)
async def delete_problem(problem_id: int, db: AsyncSession = Depends(get_db)):
    await problem_service.delete(db, problem_id)
