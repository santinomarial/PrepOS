from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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

    model_config = {"from_attributes": True}
