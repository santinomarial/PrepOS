from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.analytics import SummaryResponse, WeaknessesResponse
from app.services import analytics
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/weaknesses", response_model=WeaknessesResponse)
async def get_weaknesses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Topics and tags ranked by weakness score (highest = most in need of review)."""
    return await analytics.get_weaknesses(db, current_user.id)


@router.get("/summary", response_model=SummaryResponse)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Overall stats: totals, average success rate, streak, and topic extremes."""
    return await analytics.get_summary(db, current_user.id)
