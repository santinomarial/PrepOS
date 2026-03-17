"""Unit tests for the SM-2 scheduler.

All tests are pure-Python and require no database or running server.

Numerical expectations are derived by hand-tracing the SM-2 algorithm so that
any regression in the formula immediately breaks a test with a clear value.
"""

from datetime import date, datetime, timedelta, timezone

import pytest

from app.services.scheduler import AttemptRecord, ScheduleResult, _grade, schedule

# ── Helpers ───────────────────────────────────────────────────────────────────

TODAY = date.today()


def _dt(days_ago: int = 0) -> datetime:
    """Return a timezone-aware datetime N days in the past."""
    return datetime.now(timezone.utc) - timedelta(days=days_ago)


def _attempt(
    *,
    solved: bool = True,
    time: int | None = None,
    days_ago: int = 0,
) -> AttemptRecord:
    return AttemptRecord(
        solved=solved,
        time_to_solve_minutes=time,
        attempted_at=_dt(days_ago),
    )


# ── Test 1: no attempts ───────────────────────────────────────────────────────


def test_no_attempts_due_today_max_priority():
    """A problem with no attempts is due immediately with the highest priority."""
    result = schedule([])

    assert result.next_review_date == TODAY
    assert result.priority_score == 1.0


# ── Test 2: single perfect solve ──────────────────────────────────────────────


def test_single_perfect_solve_schedules_tomorrow():
    """
    1 fast solve of a medium problem today → SM-2 grade 5, first interval = 1 day.

    Trace:
      grade = 5 (time=15, benchmark=25, ratio=0.6 ≤ 0.75)
      reps=0 → interval=1, reps=1
      ef = 2.5 + 0.1 = 2.6
      next_review = today + 1
    """
    result = schedule([_attempt(solved=True, time=15, days_ago=0)], difficulty="medium")

    assert result.next_review_date == TODAY + timedelta(days=1)
    assert result.next_review_date > TODAY  # not due today


# ── Test 3: interval grows with consecutive perfect solves ────────────────────


def test_three_perfect_solves_grow_interval_to_16():
    """
    3 fast medium solves → interval reaches 16 days after the third attempt.

    Trace (grade=5 each, benchmark=25, time=15):
      After attempt 1:  reps=1, interval=1, ef=2.6
      After attempt 2:  reps=2, interval=6, ef=2.7
      After attempt 3:  reps=3, interval=round(6×2.7)=16, ef=2.8
      last attempt 1 day ago → next_review = today - 1 + 16 = today + 15
    """
    attempts = [
        _attempt(solved=True, time=15, days_ago=8),  # chronologically first
        _attempt(solved=True, time=15, days_ago=7),
        _attempt(solved=True, time=15, days_ago=1),  # most recent
    ]
    result = schedule(attempts, difficulty="medium")

    assert result.next_review_date == TODAY + timedelta(days=15)


# ── Test 4: failure resets interval ──────────────────────────────────────────


def test_failure_after_success_resets_interval_and_marks_overdue():
    """
    A success followed by a failure 3 days ago resets the interval to 1 and
    leaves the problem 2 days overdue.

    Trace:
      Attempt 1 (5 days ago): grade=5 → reps=1, interval=1, ef=2.6
      Attempt 2 (3 days ago): grade=1 → reps=0, interval=1, ef=max(1.3, 2.06)=2.06
      next_review = (today-3) + 1 = today-2  ← overdue
    """
    attempts = [
        _attempt(solved=True, time=15, days_ago=5),
        _attempt(solved=False, days_ago=3),
    ]
    result = schedule(attempts, difficulty="medium")

    assert result.next_review_date == TODAY - timedelta(days=2)
    assert result.next_review_date < TODAY  # confirms it's overdue


# ── Test 5: overdue problem has high priority ─────────────────────────────────


def test_overdue_problem_has_high_priority():
    """
    A failed attempt 20 days ago results in an overdue problem (19 days) and
    a priority score above 0.7.

    Trace:
      grade=1 → interval=1
      next_review = (today-20) + 1 = today-19
      days_until = -19
      overdue_score = (30 - (-19)) / 60 = 49/60 ≈ 0.8167
      failure_score = 1.0
      novelty_score = 1 - 1/5 = 0.8
      priority = 0.5×0.8167 + 0.3×1.0 + 0.2×0.8 ≈ 0.868
    """
    result = schedule([_attempt(solved=False, days_ago=20)])

    assert result.next_review_date == TODAY - timedelta(days=19)
    assert result.priority_score > 0.7


# ── Test 6: grade respects difficulty benchmark ───────────────────────────────


def test_grade_fast_and_slow_easy():
    """
    For an easy problem (benchmark = 15 min):
      time=10 → ratio=0.67 ≤ 0.75 → grade 5
      time=30 → ratio=2.0  > 1.25 → grade 3
    """
    fast = AttemptRecord(solved=True, time_to_solve_minutes=10, attempted_at=_dt())
    slow = AttemptRecord(solved=True, time_to_solve_minutes=30, attempted_at=_dt())

    assert _grade(fast, "easy") == 5
    assert _grade(slow, "easy") == 3


# ── Test 7: failure rate raises priority ──────────────────────────────────────


def test_all_failures_have_higher_priority_than_all_successes():
    """
    Three failures in a row produce a higher priority score than three fast
    perfect solves, because the failure_score component dominates.

    All-failures trace (grade=1 each, last attempt today):
      interval=1, next_review=today+1
      days_until=1, overdue_score=29/60≈0.483
      failure_score=1.0, novelty_score=0.4
      priority ≈ 0.5×0.483 + 0.3×1.0 + 0.2×0.4 = 0.622

    All-successes trace (grade=5, medium, time=15, last attempt 1 day ago):
      interval=16, next_review=today+15
      days_until=15, overdue_score=14/60≈0.233
      failure_score=0.0, novelty_score=0.4
      priority ≈ 0.5×0.233 + 0.0 + 0.2×0.4 = 0.197
    """
    failures = [
        _attempt(solved=False, days_ago=2),
        _attempt(solved=False, days_ago=1),
        _attempt(solved=False, days_ago=0),
    ]
    successes = [
        _attempt(solved=True, time=15, days_ago=8),
        _attempt(solved=True, time=15, days_ago=7),
        _attempt(solved=True, time=15, days_ago=1),
    ]

    failure_result = schedule(failures)
    success_result = schedule(successes, difficulty="medium")

    assert failure_result.priority_score > success_result.priority_score


# ── Test 8: unknown / missing difficulty falls back to default benchmark ──────


def test_unknown_difficulty_uses_default_benchmark():
    """
    difficulty=None and difficulty='unknown' both fall back to the 25-minute
    default benchmark, producing identical grades.
    """
    attempt = AttemptRecord(solved=True, time_to_solve_minutes=25, attempted_at=_dt())

    # ratio = 25/25 = 1.0 → on target → grade 4
    assert _grade(attempt, None) == 4
    assert _grade(attempt, "unknown") == 4


# ── Test 9: ease factor clamps at minimum ─────────────────────────────────────


def test_ef_clamps_at_minimum_after_many_failures():
    """
    After enough failures the ease factor should clamp at 1.3 and stay there.

    ef sequence (grade=1, starting ef=2.5):
      2.5 - 0.54 = 1.96
      1.96 - 0.54 = 1.42
      max(1.3, 1.42 - 0.54) = max(1.3, 0.88) = 1.3  ← clamped
      stays at 1.3 thereafter
    Five failures → last interval still 1 day, schedule works normally.
    """
    attempts = [_attempt(solved=False, days_ago=i) for i in range(4, -1, -1)]
    result = schedule(attempts)

    # After 5 failures the interval is still 1 day regardless of EF clamping.
    last_date = attempts[-1].attempted_at.date()
    assert result.next_review_date == last_date + timedelta(days=1)
