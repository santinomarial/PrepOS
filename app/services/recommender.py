"""Recommendation service.

Scores every problem with a weighted composite and returns the top N.

Score formula (all components normalised to [0, 1]):
    score = 0.4 * topic_weakness
          + 0.3 * overdue_score
          + 0.2 * difficulty_fit
          + 0.1 * recency_score

See ALGORITHM.md at the project root for a full explanation.
"""

from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.problem import Problem
from app.schemas.recommender import Recommendation, RecommendResponse
from app.services.analytics import topic_stats_map
from app.services.scheduler import AttemptRecord, schedule

# ── Difficulty mapping ────────────────────────────────────────────────────────

_DIFFICULTY_LEVEL: dict[str, int] = {"easy": 1, "medium": 2, "hard": 3}
_UNKNOWN_LEVEL = 2  # unknown difficulty treated as medium


# ── Component helpers ─────────────────────────────────────────────────────────


def _recent_success_rate(problems: list[Problem], n: int = 10) -> float:
    """Success rate of the N most recent attempts across all problems.

    Returns 0.5 (neutral) when there are no attempts at all.
    """
    all_attempts = sorted(
        (a for p in problems for a in p.attempts),
        key=lambda a: a.attempted_at,
    )
    recent = all_attempts[-n:]
    if not recent:
        return 0.5
    return sum(1 for a in recent if a.solved) / len(recent)


def _target_difficulty(recent_sr: float) -> int:
    """Map recent success rate to a target difficulty level (1=easy, 2=medium, 3=hard).

    ≥ 0.8 → ready for hard
    ≥ 0.5 → stay at medium
    < 0.5 → focus on easy
    """
    if recent_sr >= 0.8:
        return 3
    if recent_sr >= 0.5:
        return 2
    return 1


def _difficulty_fit(difficulty: Optional[str], target: int) -> float:
    """Score how well a problem's difficulty matches the target level.

    Same level   → 1.0
    One level off → 0.5
    Two levels off → 0.0
    """
    level = _DIFFICULTY_LEVEL.get((difficulty or "").lower(), _UNKNOWN_LEVEL)
    return max(0.0, 1.0 - 0.5 * abs(level - target))


def _overdue_score(days_overdue: int) -> float:
    """Linear ramp: 0 days overdue → 0.0, 30+ days overdue → 1.0."""
    return min(1.0, days_overdue / 30)


def _recency_score(days_since: Optional[int]) -> float:
    """Score reflecting how long ago the problem was last attempted.

    Never attempted    → 1.0
    Attempted today    → 0.0
    Attempted 14+ days → 1.0
    """
    if days_since is None:
        return 1.0
    return min(1.0, days_since / 14)


# ── Reason string ─────────────────────────────────────────────────────────────


def _build_reason(
    topic: Optional[str],
    topic_success_rate: Optional[float],
    days_overdue: int,
    diff_fit: float,
    difficulty: Optional[str],
    days_since: Optional[int],
) -> str:
    """Compose a human-readable explanation by picking the two most informative clauses.

    Clause priority:
      1. Days overdue (most actionable)
      2. Topic weakness (most educational)
      3. Never attempted (clear gap)
      4. Difficulty matches progression (motivating)
      5. Not seen recently (simple reminder)
      6. Fallback
    """
    clauses: list[str] = []

    if days_overdue > 0:
        word = "day" if days_overdue == 1 else "days"
        clauses.append(f"this problem is {days_overdue} {word} overdue")

    if topic and topic_success_rate is not None and topic_success_rate < 0.7:
        pct = round(topic_success_rate * 100)
        clauses.append(f"topic '{topic}' has {pct}% success rate")

    if days_since is None:
        clauses.append("this problem has never been attempted")

    if diff_fit >= 0.8 and difficulty:
        clauses.append(f"the {difficulty} difficulty matches your current skill level")

    if days_since is not None and days_since >= 7:
        clauses.append(f"last attempted {days_since} days ago")

    if not clauses:
        clauses.append("this problem fits your current practice schedule")

    sentence = " and ".join(clauses[:2])
    return sentence[0].upper() + sentence[1:] + "."


# ── DB loader ─────────────────────────────────────────────────────────────────


async def _load_problems(db: AsyncSession, user_id: int) -> list[Problem]:
    result = await db.execute(
        select(Problem)
        .options(selectinload(Problem.attempts))
        .where(Problem.user_id == user_id)
    )
    return list(result.scalars().all())


# ── Public API ────────────────────────────────────────────────────────────────


async def get_recommendations(db: AsyncSession, top_n: int = 5, user_id: int = 0) -> RecommendResponse:
    problems = await _load_problems(db, user_id)
    today = date.today()

    # Topic weakness and success rate for every topic that has attempts.
    # {topic: (weakness_score, success_rate)}
    t_stats = topic_stats_map(problems)

    # Difficulty progression: derive target from recent performance.
    recent_sr = _recent_success_rate(problems)
    target_diff = _target_difficulty(recent_sr)

    scored: list[tuple[Problem, float, str]] = []

    for p in problems:
        # ── SM-2 overdue ──────────────────────────────────────────────────────
        records = [
            AttemptRecord(
                solved=a.solved,
                time_to_solve_minutes=a.time_to_solve_minutes,
                attempted_at=a.attempted_at,
            )
            for a in p.attempts
        ]
        sched = schedule(records, difficulty=p.difficulty)
        days_until = (sched.next_review_date - today).days
        days_overdue = max(0, -days_until)

        # ── Topic weakness ────────────────────────────────────────────────────
        if p.topic and p.topic in t_stats:
            topic_weakness, topic_sr = t_stats[p.topic]
        else:
            topic_weakness, topic_sr = 0.5, None  # neutral — no topic data

        # ── Difficulty fit ────────────────────────────────────────────────────
        diff_fit = _difficulty_fit(p.difficulty, target_diff)

        # ── Recency ───────────────────────────────────────────────────────────
        if p.attempts:
            last_dt = max(a.attempted_at for a in p.attempts)
            days_since: Optional[int] = (today - last_dt.date()).days
        else:
            days_since = None

        # ── Composite score ───────────────────────────────────────────────────
        composite = round(
            0.4 * topic_weakness
            + 0.3 * _overdue_score(days_overdue)
            + 0.2 * diff_fit
            + 0.1 * _recency_score(days_since),
            4,
        )

        reason = _build_reason(
            topic=p.topic,
            topic_success_rate=topic_sr,
            days_overdue=days_overdue,
            diff_fit=diff_fit,
            difficulty=p.difficulty,
            days_since=days_since,
        )

        scored.append((p, composite, reason))

    scored.sort(key=lambda x: x[1], reverse=True)

    return RecommendResponse(
        recommendations=[
            Recommendation(
                problem_id=p.id,
                title=p.title,
                topic=p.topic,
                difficulty=p.difficulty,
                url=p.url,
                score=score,
                reason=reason,
            )
            for p, score, reason in scored[:top_n]
        ]
    )
