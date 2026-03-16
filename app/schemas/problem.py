from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from pydantic import BaseModel, Field, computed_field

if TYPE_CHECKING:
    from app.schemas.attempt import AttemptRead


class ProblemBase(BaseModel):
    title: str
    url: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    tags: Optional[str] = None
    notes: Optional[str] = None


class ProblemCreate(ProblemBase):
    pass


class ProblemUpdate(ProblemBase):
    title: Optional[str] = None


class ProblemRead(ProblemBase):
    id: int
    created_at: datetime
    # Loaded from the ORM relationship but not serialised into the response.
    attempts: List["AttemptRead"] = Field(default=[], exclude=True)

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def attempt_count(self) -> int:
        return len(self.attempts)

    @computed_field
    @property
    def last_attempted_at(self) -> Optional[datetime]:
        if not self.attempts:
            return None
        return max(a.attempted_at for a in self.attempts)

    @computed_field
    @property
    def success_rate(self) -> Optional[float]:
        if not self.attempts:
            return None
        solved = sum(1 for a in self.attempts if a.solved)
        return round(solved / len(self.attempts) * 100, 1)
