from typing import List, Optional

from pydantic import BaseModel


class Recommendation(BaseModel):
    problem_id: int
    title: str
    topic: Optional[str]
    difficulty: Optional[str]
    url: Optional[str]
    score: float  # composite recommendation score in [0, 1]; higher = study sooner
    reason: str   # human-readable explanation of why this problem was selected


class RecommendResponse(BaseModel):
    recommendations: List[Recommendation]
