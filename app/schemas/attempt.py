from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AttemptBase(BaseModel):
    problem_id: int
    solved: bool = False
    time_to_solve_minutes: Optional[int] = None
    mistakes: Optional[str] = None


class AttemptCreate(AttemptBase):
    pass


class AttemptUpdate(BaseModel):
    solved: Optional[bool] = None
    time_to_solve_minutes: Optional[int] = None
    mistakes: Optional[str] = None


class AttemptRead(AttemptBase):
    id: int
    attempted_at: datetime

    model_config = {"from_attributes": True}
