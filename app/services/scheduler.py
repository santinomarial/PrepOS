"""SM-2 spaced repetition scheduler.

Pure-Python module — no I/O, no database access.

Grade scale (0–5):
  0–2  failed recall       → interval resets to 1 day
  3    correct but hard    → interval advances, EF drops
  4    correct, on-time    → interval advances, EF unchanged
  5    perfect / fast      → interval advances, EF increases

Priority score (0–1): higher means "review sooner".
Components:
  - overdue_score  (50 %) — how far past the due date the problem is
  - failure_score  (30 %) — fraction of attempts that were not solved
  - novelty_score  (20 %) — boost for problems with fewer than 5 attempts
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

# ── SM-2 constants ────────────────────────────────────────────────────────────
_INITIAL_EF = 2.5
_MIN_EF = 1.3

# Expected solve times (minutes) per difficulty level.
_BENCHMARKS: dict[str, float] = {
    "easy": 15.0,
    "medium": 25.0,
    "hard": 40.0,
}
_DEFAULT_BENCHMARK = 25.0  # fallback when difficulty is absent / unrecognised


# ── Public types ──────────────────────────────────────────────────────────────


@dataclass
class AttemptRecord:
    """Lightweight, scheduler-specific view of one attempt."""

    solved: bool
    time_to_solve_minutes: Optional[int]
    attempted_at: datetime


@dataclass
class ScheduleResult:
    next_review_date: date
    priority_score: float  # 0.0–1.0


# ── Internal helpers ──────────────────────────────────────────────────────────


def _grade(attempt: AttemptRecord, difficulty: Optional[str]) -> int:
    """Convert an attempt to an SM-2 quality grade (0–5).

    Failed attempt                    → 1
    Solved, no timing info            → 3  (conservative)
    Solved, time ≤ 75 % of benchmark  → 5  (fast / perfect recall)
    Solved, time ≤ 125 % of benchmark → 4  (on target)
    Solved, time  > 125 % of benchmark → 3  (slow but correct)
    """
    if not attempt.solved:
        return 1

    benchmark = _BENCHMARKS.get((difficulty or "").lower(), _DEFAULT_BENCHMARK)
    t = attempt.time_to_solve_minutes

    if t is None:
        return 3

    ratio = t / benchmark
    if ratio <= 0.75:
        return 5
    if ratio <= 1.25:
        return 4
    return 3


# ── Public API ────────────────────────────────────────────────────────────────


def schedule(
    attempts: list[AttemptRecord],
    difficulty: Optional[str] = None,
) -> ScheduleResult:
    """Run SM-2 over the full attempt history.

    Returns the next review date and a priority score in [0, 1].
    A problem that has never been attempted is due immediately with
    the maximum priority of 1.0.
    """
    today = date.today()

    if not attempts:
        return ScheduleResult(next_review_date=today, priority_score=1.0)

    chronological = sorted(attempts, key=lambda a: a.attempted_at)

    ef = _INITIAL_EF
    interval = 1
    repetitions = 0  # consecutive successful responses

    for attempt in chronological:
        grade = _grade(attempt, difficulty)

        if grade < 3:
            # Failed: reset streak and interval.
            repetitions = 0
            interval = 1
        else:
            # Successful: advance interval according to SM-2 schedule.
            if repetitions == 0:
                interval = 1
            elif repetitions == 1:
                interval = 6
            else:
                interval = round(interval * ef)
            repetitions += 1

        # Update ease factor (clamped to minimum).
        ef = max(_MIN_EF, ef + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))

    last_date = chronological[-1].attempted_at.date()
    next_review_date = last_date + timedelta(days=interval)

    # ── Priority score ────────────────────────────────────────────────────────
    # overdue_score: linear ramp [0, 1] over a ±30-day window around due date.
    #   days_until = -30 → 1.0 (very overdue)
    #   days_until =   0 → 0.5 (due today)
    #   days_until = +30 → 0.0 (far in the future)
    days_until = (next_review_date - today).days
    overdue_score = max(0.0, min(1.0, (30 - days_until) / 60))

    # failure_score: fraction of attempts that were not solved.
    n = len(attempts)
    failure_score = 1.0 - sum(1 for a in attempts if a.solved) / n

    # novelty_score: small boost for problems with fewer than 5 attempts
    # (still in early acquisition phase).
    novelty_score = max(0.0, 1.0 - n / 5)

    priority_score = round(
        min(1.0, max(0.0, 0.5 * overdue_score + 0.3 * failure_score + 0.2 * novelty_score)),
        4,
    )

    return ScheduleResult(next_review_date=next_review_date, priority_score=priority_score)
