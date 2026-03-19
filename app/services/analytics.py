"""Analytics service — pure aggregation, no HTTP concerns.

All computation is done in Python after a single eager-loaded DB query per
endpoint call.  For an interview-prep app the dataset stays small, so this is
fine; if it ever grows, the bucket-building functions are easy to replace with
SQL GROUP BY queries.

Weakness score formula (per group):
    weakness = (1 - success_rate) * 0.6 + normalized_avg_solve_time * 0.4

normalized_avg_solve_time is min-max normalised across all groups of the same
type (topics normalised among topics, tags among tags).  Groups with no timing
data receive a normalised value of 0.0 — they incur no time penalty, so their
weakness score is determined entirely by their failure rate.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.problem import Problem
from app.schemas.analytics import GroupStats, SummaryResponse, WeaknessesResponse


# ── Internal accumulator ──────────────────────────────────────────────────────


@dataclass
class _Bucket:
    total: int = 0
    solved: int = 0
    times: list[float] = field(default_factory=list)

    def success_rate(self) -> float:
        return self.solved / self.total if self.total else 0.0

    def avg_time(self) -> Optional[float]:
        return sum(self.times) / len(self.times) if self.times else None


# ── Normalisation + scoring ───────────────────────────────────────────────────


def _normalize(values: list[Optional[float]]) -> list[float]:
    """Min-max normalise a list of optional floats.

    None entries (no timing data) are mapped to 0.0.
    When all non-None values are identical the range is zero; every entry maps
    to 0.0 to avoid division by zero.
    """
    nums = [v for v in values if v is not None]
    if not nums:
        return [0.0] * len(values)
    lo, hi = min(nums), max(nums)
    if hi == lo:
        return [0.0] * len(values)
    return [0.0 if v is None else (v - lo) / (hi - lo) for v in values]


def _weakness_score(success_rate: float, norm_time: float) -> float:
    return round((1.0 - success_rate) * 0.6 + norm_time * 0.4, 4)


# ── Streak helper ─────────────────────────────────────────────────────────────


def _compute_streak(dates: list[date]) -> int:
    """Return the current practice streak in days.

    A streak is the number of consecutive calendar days—ending on today or
    yesterday—on which at least one attempt was made.  If the most recent
    practice day is two or more days in the past the streak is 0.
    """
    if not dates:
        return 0

    today = date.today()
    unique = sorted(set(dates), reverse=True)  # most recent first

    # Streak is broken if there has been no activity for two full days.
    if unique[0] < today - timedelta(days=1):
        return 0

    streak = 0
    expected = unique[0]  # start counting from the most recent practice day
    for d in unique:
        if d == expected:
            streak += 1
            expected -= timedelta(days=1)
        elif d < expected:
            break  # gap found — streak ends here

    return streak


# ── DB loader ─────────────────────────────────────────────────────────────────


async def _load_problems(db: AsyncSession, user_id: int) -> list[Problem]:
    result = await db.execute(
        select(Problem)
        .options(selectinload(Problem.attempts))
        .where(Problem.user_id == user_id)
    )
    return list(result.scalars().all())


# ── Bucket builders ───────────────────────────────────────────────────────────


def _topic_buckets(problems: list[Problem]) -> dict[str, _Bucket]:
    buckets: dict[str, _Bucket] = defaultdict(_Bucket)
    for p in problems:
        if not p.topic:
            continue
        b = buckets[p.topic]
        for a in p.attempts:
            b.total += 1
            if a.solved:
                b.solved += 1
            if a.time_to_solve_minutes is not None:
                b.times.append(float(a.time_to_solve_minutes))
    return buckets


def _tag_buckets(problems: list[Problem]) -> dict[str, _Bucket]:
    """Build per-tag buckets.

    Tags are stored as comma-separated text on each problem.  A single attempt
    is counted under every tag its problem carries — this is intentional so the
    weakness score reflects performance across all problems sharing a tag.
    """
    buckets: dict[str, _Bucket] = defaultdict(_Bucket)
    for p in problems:
        if not p.tags:
            continue
        tags = [t.strip() for t in p.tags.split(",") if t.strip()]
        for tag in tags:
            b = buckets[tag]
            for a in p.attempts:
                b.total += 1
                if a.solved:
                    b.solved += 1
                if a.time_to_solve_minutes is not None:
                    b.times.append(float(a.time_to_solve_minutes))
    return buckets


# ── Bucket → schema conversion ────────────────────────────────────────────────


def _to_stats(buckets: dict[str, _Bucket]) -> list[GroupStats]:
    """Convert buckets to GroupStats, normalise solve times, and sort by weakness."""
    names = list(buckets.keys())
    raw_times = [buckets[n].avg_time() for n in names]
    norm_times = _normalize(raw_times)

    stats: list[GroupStats] = []
    for name, raw_t, norm_t in zip(names, raw_times, norm_times):
        b = buckets[name]
        sr = b.success_rate()
        stats.append(
            GroupStats(
                name=name,
                total_attempts=b.total,
                success_rate=round(sr, 4),
                avg_solve_time=round(raw_t, 1) if raw_t is not None else None,
                weakness_score=_weakness_score(sr, norm_t),
            )
        )

    return sorted(stats, key=lambda s: s.weakness_score, reverse=True)


# ── Shared helpers (used by other services) ───────────────────────────────────


def topic_stats_map(problems: list[Problem]) -> dict[str, tuple[float, float]]:
    """Return {topic: (weakness_score, success_rate)} for all topics with attempts.

    Called by the recommender service so it can borrow topic-weakness data
    without duplicating the bucket-building logic.
    """
    return {s.name: (s.weakness_score, s.success_rate) for s in _to_stats(_topic_buckets(problems))}


# ── Public API ────────────────────────────────────────────────────────────────


async def get_weaknesses(db: AsyncSession, user_id: int) -> WeaknessesResponse:
    problems = await _load_problems(db, user_id)
    return WeaknessesResponse(
        topics=_to_stats(_topic_buckets(problems)),
        tags=_to_stats(_tag_buckets(problems)),
    )


async def get_summary(db: AsyncSession, user_id: int) -> SummaryResponse:
    problems = await _load_problems(db, user_id)

    all_attempts = [a for p in problems for a in p.attempts]
    total_attempts = len(all_attempts)
    total_solved = sum(1 for a in all_attempts if a.solved)

    avg_success_rate = (
        round(total_solved / total_attempts, 4) if total_attempts else 0.0
    )

    streak = _compute_streak([a.attempted_at.date() for a in all_attempts])

    # Strongest / weakest topic — derived from the same weakness ranking.
    topic_stats = _to_stats(_topic_buckets(problems))  # sorted desc by weakness
    weakest_topic = topic_stats[0].name if topic_stats else None
    strongest_topic = topic_stats[-1].name if topic_stats else None

    return SummaryResponse(
        total_problems=len(problems),
        total_attempts=total_attempts,
        avg_success_rate=avg_success_rate,
        current_streak_days=streak,
        strongest_topic=strongest_topic,
        weakest_topic=weakest_topic,
    )
