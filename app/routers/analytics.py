from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.analytics import SummaryResponse, WeaknessesResponse
from app.services import analytics

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/weaknesses", response_model=WeaknessesResponse)
async def get_weaknesses(db: AsyncSession = Depends(get_db)):
    """Topics and tags ranked by weakness score (highest = most in need of review)."""
    return await analytics.get_weaknesses(db)


@router.get("/summary", response_model=SummaryResponse)
async def get_summary(db: AsyncSession = Depends(get_db)):
    """Overall stats: totals, average success rate, streak, and topic extremes."""
    return await analytics.get_summary(db)
