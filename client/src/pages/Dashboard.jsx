import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analytics, problems as problemsApi, recommend } from '../api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIFFICULTY_BADGE = {
  easy:   'bg-green-50  text-green-700',
  medium: 'bg-yellow-50 text-yellow-700',
  hard:   'bg-red-50    text-red-700',
};

function badge(difficulty) {
  return DIFFICULTY_BADGE[difficulty] ?? 'bg-gray-100 text-gray-600';
}

/**
 * Map a weakness score [0..1] to a Tailwind bg colour.
 * 0   → green (strong)   1 → red (weak)
 */
function heatColor(score) {
  if (score == null) return 'bg-gray-100 text-gray-400';
  if (score >= 0.75) return 'bg-red-500   text-white';
  if (score >= 0.55) return 'bg-orange-400 text-white';
  if (score >= 0.40) return 'bg-yellow-300 text-gray-800';
  if (score >= 0.25) return 'bg-lime-300   text-gray-800';
  return                     'bg-green-400  text-white';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value ?? '—'}</p>
    </div>
  );
}

function RecommendCard({ rec }) {
  return (
    <Link
      to={`/problems/${rec.problem_id}`}
      className="block bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-indigo-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{rec.title}</p>
          {rec.topic && (
            <p className="text-xs text-gray-400 mt-0.5">{rec.topic}</p>
          )}
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{rec.reason}</p>
        </div>
        {rec.difficulty && (
          <span className={`shrink-0 mt-0.5 text-xs px-2 py-0.5 rounded font-medium ${badge(rec.difficulty)}`}>
            {rec.difficulty}
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Topic Heatmap ─────────────────────────────────────────────────────────────

function TopicHeatmap({ topics }) {
  if (!topics || topics.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Topic mastery</h2>
      <div className="flex flex-wrap gap-2">
        {topics.map((t) => (
          <div
            key={t.topic}
            title={`${t.topic}: ${Math.round((1 - t.weakness_score) * 100)}% mastery · ${t.total_attempts} attempt${t.total_attempts !== 1 ? 's' : ''}`}
            className={`rounded-md px-3 py-2 text-xs font-medium cursor-default select-none transition-transform hover:scale-105 ${heatColor(t.weakness_score)}`}
          >
            <span className="block">{t.topic}</span>
            <span className="block opacity-80 mt-0.5">
              {Math.round((1 - t.weakness_score) * 100)}%
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-gray-400">Weak</span>
        <div className="flex gap-0.5">
          {['bg-red-500','bg-orange-400','bg-yellow-300','bg-lime-300','bg-green-400'].map((c) => (
            <div key={c} className={`w-5 h-2 rounded-sm ${c}`} />
          ))}
        </div>
        <span className="text-xs text-gray-400">Strong</span>
      </div>
    </div>
  );
}

// ── Weaknesses Panel ──────────────────────────────────────────────────────────

function WeaknessesPanel({ topics }) {
  const bottom3 = [...(topics ?? [])]
    .sort((a, b) => b.weakness_score - a.weakness_score)
    .slice(0, 3);

  if (bottom3.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Needs work</h2>
      <div className="space-y-2">
        {bottom3.map((t) => {
          const mastery = Math.round((1 - t.weakness_score) * 100);
          const successPct = t.success_rate != null ? Math.round(t.success_rate * 100) : null;
          const avgTime = t.avg_time_minutes != null ? Math.round(t.avg_time_minutes) : null;

          return (
            <div
              key={t.topic}
              className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{t.topic}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {successPct != null && (
                    <span className="text-xs text-gray-500">{successPct}% success</span>
                  )}
                  {avgTime != null && (
                    <>
                      <span className="text-gray-300 text-xs">·</span>
                      <span className="text-xs text-gray-500">avg {avgTime}m</span>
                    </>
                  )}
                  <span className="text-gray-300 text-xs">·</span>
                  <span className="text-xs text-gray-500">{t.total_attempts} attempt{t.total_attempts !== 1 ? 's' : ''}</span>
                </div>
              </div>
              {/* mini progress bar */}
              <div className="shrink-0 w-20">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${mastery}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 text-right mt-0.5">{mastery}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [summary,   setSummary]   = useState(null);
  const [dueCount,  setDueCount]  = useState(null);
  const [recs,      setRecs]      = useState([]);
  const [topics,    setTopics]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  useEffect(() => {
    Promise.all([
      analytics.summary(),
      problemsApi.due(),
      recommend.top(3),
      analytics.weaknesses(),
    ])
      .then(([sum, due, rec, weak]) => {
        setSummary(sum);
        setDueCount(due.length);
        setRecs(rec.recommendations);
        // weaknesses returns { topics: [...], tags: [...] }
        setTopics(weak.topics ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  if (error)   return <div className="p-8 text-sm text-red-600">{error}</div>;

  const successPct = summary
    ? Math.round((summary.avg_success_rate ?? 0) * 100)
    : null;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Dashboard</h1>

      {/* ── Stats grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Problems"     value={summary?.total_problems} />
        <StatCard label="Due today"    value={dueCount} />
        <StatCard label="Streak"       value={summary ? `${summary.current_streak_days}d` : null} />
        <StatCard label="Success rate" value={successPct != null ? `${successPct}%` : null} />
      </div>

      {/* ── Topic heatmap ────────────────────────────────────────────── */}
      <TopicHeatmap topics={topics} />

      {/* ── Weaknesses panel ─────────────────────────────────────────── */}
      <WeaknessesPanel topics={topics} />

      {/* ── Recommendations ──────────────────────────────────────────── */}
      <h2 className="text-sm font-medium text-gray-700 mb-3">Recommended now</h2>

      {recs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-6 text-center">
          <p className="text-sm text-gray-400">No recommendations yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Add problems and log a few attempts to get personalised suggestions.
          </p>
          <Link
            to="/problems"
            className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:underline"
          >
            Go to Problems →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {recs.map((rec) => (
            <RecommendCard key={rec.problem_id} rec={rec} />
          ))}
        </div>
      )}
    </div>
  );
}
