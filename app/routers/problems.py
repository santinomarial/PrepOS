from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.attempt import AttemptCreateBody, AttemptRead
from app.schemas.problem import ProblemCreate, ProblemRead, ProblemUpdate
from app.services import attempt_service, problem_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/problems", tags=["problems"])


@router.get("/", response_model=List[ProblemRead])
async def list_problems(
    topic: Optional[str] = Query(None, description="Filter by topic"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty"),
    tag: Optional[str] = Query(None, description="Filter by tag (substring match)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await problem_service.get_all(
        db, current_user.id, topic=topic, difficulty=difficulty, tag=tag
    )


# NOTE: /due must be declared before /{problem_id} so FastAPI does not attempt
# to coerce the literal string "due" to an integer path parameter.
@router.get("/due", response_model=List[ProblemRead])
async def list_due_problems(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all problems whose next_review_date is today or earlier,
    sorted by priority_score descending (most urgent first)."""
    return await problem_service.get_due(db, current_user.id)


@router.get("/{problem_id}", response_model=ProblemRead)
async def get_problem(
    problem_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await problem_service.get_by_id(db, problem_id, current_user.id)


@router.post("/", response_model=ProblemRead, status_code=201)
async def create_problem(
    payload: ProblemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await problem_service.create(db, payload, current_user.id)


@router.patch("/{problem_id}", response_model=ProblemRead)
async def update_problem(
    problem_id: int,
    payload: ProblemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await problem_service.update(db, problem_id, payload, current_user.id)


@router.delete("/{problem_id}", status_code=204)
async def delete_problem(
    problem_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await problem_service.delete(db, problem_id, current_user.id)


# --- Nested attempts ---


@router.get("/{problem_id}/attempts", response_model=List[AttemptRead], tags=["attempts"])
async def list_problem_attempts(
    problem_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await problem_service.get_by_id(db, problem_id, current_user.id)  # 404 if not found/not owned
    return await attempt_service.get_by_problem_id(db, problem_id)


@router.post(
    "/{problem_id}/attempts",
    response_model=AttemptRead,
    status_code=201,
    tags=["attempts"],
)
async def create_problem_attempt(
    problem_id: int,
    payload: AttemptCreateBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await problem_service.get_by_id(db, problem_id, current_user.id)  # 404 if not found/not owned
    return await attempt_service.create_for_problem(db, problem_id, payload)
