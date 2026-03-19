from typing import List, Optional

from pydantic import BaseModel


class GroupStats(BaseModel):
    """Aggregated stats for a single topic or tag group."""

    name: str
    total_attempts: int
    success_rate: float  # 0.0–1.0
    avg_solve_time: Optional[float]  # minutes; None when no attempt has timing data
    weakness_score: float  # 0.0–1.0, higher = weaker


class WeaknessesResponse(BaseModel):
    topics: List[GroupStats]  # ranked by weakness_score descending
    tags: List[GroupStats]  # ranked by weakness_score descending


class SummaryResponse(BaseModel):
    total_problems: int
    total_attempts: int
    avg_success_rate: float  # total_solved / total_attempts; 0.0 when no attempts
    current_streak_days: int  # consecutive calendar days with ≥1 attempt ending today/yesterday
    strongest_topic: Optional[str]  # lowest weakness_score among topics with attempts
    weakest_topic: Optional[str]  # highest weakness_score among topics with attempts
