from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.recommender import RecommendResponse
from app.services import recommender

router = APIRouter(prefix="/recommend", tags=["recommend"])


@router.get("/", response_model=RecommendResponse)
async def get_recommendations(
    top_n: int = Query(default=5, ge=1, le=20, description="Number of problems to return"),
    db: AsyncSession = Depends(get_db),
):
    """Return the top problems to study right now, ranked by a composite score
    combining topic weakness, SM-2 overdue status, difficulty progression fit,
    and recency."""
    return await recommender.get_recommendations(db, top_n=top_n)
