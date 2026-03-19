# Recommendation Algorithm

`GET /recommend` returns the top N problems to study right now.
Every problem in the database is scored, then the highest-scoring problems are returned with a plain-English reason string.

---

## Composite score

```
score = 0.4 × topic_weakness
      + 0.3 × overdue_score
      + 0.2 × difficulty_fit
      + 0.1 × recency_score
```

All four components are normalised to **[0, 1]** before weighting, so the final score is also in [0, 1].  Higher means "study this sooner."

---

## Component breakdown

### 1. Topic weakness — weight 0.4

Source: `services/analytics.py → topic_stats_map()`

The analytics service groups every attempt by topic and computes:

```
topic_weakness = (1 − success_rate) × 0.6
               + normalised_avg_solve_time × 0.4
```

`normalised_avg_solve_time` is min-max normalised across all topics so the fastest topic scores 0 and the slowest scores 1.

A problem inherits the weakness score of its topic.  Problems with no topic get a neutral score of **0.5** — enough to appear in recommendations but without inflating or deflating the ranking.

**Rationale:** topic weakness gets the highest weight because drilling a weak area is the highest-leverage use of study time.

---

### 2. Overdue score — weight 0.3

Source: `services/scheduler.py → schedule()`

The SM-2 spaced-repetition algorithm (see `services/scheduler.py`) computes a `next_review_date` for each problem based on its full attempt history.

```
days_overdue  = max(0, today − next_review_date)   # 0 when not yet due
overdue_score = min(1.0, days_overdue / 30)         # linear, caps at 30 days
```

A problem that is not yet due contributes 0 to this component; one that is 30+ days past due contributes 1.0.

**Rationale:** spaced repetition is only effective when reviews happen on schedule.  A missed review signals the memory is at risk of being lost.

---

### 3. Difficulty progression fit — weight 0.2

Source: `services/recommender.py → _difficulty_fit()`

The algorithm looks at the **10 most recent attempts** across all problems to gauge current skill level:

| Recent success rate | Target difficulty |
|---------------------|-------------------|
| ≥ 80 %              | Hard              |
| 50 – 79 %           | Medium            |
| < 50 %              | Easy              |

Each problem's difficulty is then compared to the target:

```
diff_fit = max(0, 1 − 0.5 × |problem_level − target_level|)
```

where `easy = 1, medium = 2, hard = 3`.  A perfect match scores 1.0; one level off scores 0.5; two levels off scores 0.0.  Problems with unknown difficulty are treated as medium.

**Rationale:** studying problems at the right difficulty — just above current comfort — maximises learning efficiency (zone of proximal development).

---

### 4. Recency score — weight 0.1

Source: `services/recommender.py → _recency_score()`

```
recency_score = min(1.0, days_since_last_attempt / 14)
```

A problem attempted **today** scores 0.0; one not touched for **14+ days** (or never attempted) scores 1.0.

**Rationale:** the recency component acts as a soft tie-breaker.  It prevents the same problem from dominating the list every day while ensuring problems that have been neglected gradually rise in priority.

---

## Reason string

Each recommendation includes a plain-English `reason` field.  The service picks up to **two informative clauses** from the following priority list and joins them with "and":

1. Days overdue — most actionable signal
2. Topic success rate — most educational context
3. Never attempted — clear gap in coverage
4. Difficulty matches progression — motivating framing
5. Not seen recently — simple reminder
6. Fallback — "this problem fits your current practice schedule"

Example outputs:

- `"This problem is 3 days overdue and topic 'arrays' has 40% success rate."`
- `"Topic 'trees' has 25% success rate and this problem has never been attempted."`
- `"This problem has never been attempted and the easy difficulty matches your current skill level."`

---

## Design decisions and trade-offs

**Why Python aggregation instead of SQL GROUP BY?**
For an interview-prep app the dataset is small (tens to low hundreds of problems).  Doing everything in Python after a single `selectinload` query keeps the service logic readable and testable without complex ORM expressions.  If the dataset grows, the bucket-building functions can be swapped for SQL aggregates without changing the scoring layer.

**Why min-max normalisation for topic solve time?**
Min-max keeps each component on the same [0, 1] scale and avoids the need to choose arbitrary cutoffs.  The main downside is that when all topics have the same average solve time the normalised value collapses to 0 for everyone — acceptable here because the failure-rate component still differentiates them.

**Why a 30-day cap for overdue_score?**
Beyond 30 days the memory is likely forgotten regardless; capping avoids giving astronomically overdue problems an unfair monopoly over the top-5 list, letting other factors (topic weakness, difficulty fit) remain meaningful.

**Why only the last 10 attempts for difficulty targeting?**
Using all attempts would smooth out recent improvement, potentially keeping a user stuck on easy problems long after they've grown.  Ten attempts balances recency against noise from individual hard days.

**Why weight 0.4 for topic weakness?**
Topic weakness is the most stable and information-rich signal — it aggregates many attempts rather than relying on a single problem's history.  The higher weight anchors the recommendation list to known weak areas rather than letting recency or scheduling accidents dominate.
