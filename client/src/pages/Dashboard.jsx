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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [summary, setSummary]   = useState(null);
  const [dueCount, setDueCount] = useState(null);
  const [recs, setRecs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    Promise.all([
      analytics.summary(),
      problemsApi.due(),
      recommend.top(3),
    ])
      .then(([sum, due, rec]) => {
        setSummary(sum);
        setDueCount(due.length);
        setRecs(rec.recommendations);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  }

  if (error) {
    return <div className="p-8 text-sm text-red-600">{error}</div>;
  }

  const successPct = summary
    ? Math.round((summary.avg_success_rate ?? 0) * 100)
    : null;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Dashboard</h1>

      {/* ── Stats grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Problems"     value={summary?.total_problems} />
        <StatCard label="Due today"    value={dueCount} />
        <StatCard label="Streak"       value={summary ? `${summary.current_streak_days}d` : null} />
        <StatCard label="Success rate" value={successPct != null ? `${successPct}%` : null} />
      </div>

      {/* ── Topic snapshot ──────────────────────────────────────────────── */}
      {(summary?.weakest_topic || summary?.strongest_topic) && (
        <div className="grid grid-cols-2 gap-3 mb-8">
          {summary.weakest_topic && (
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">Weakest topic</p>
              <p className="text-sm font-medium text-gray-900">{summary.weakest_topic}</p>
            </div>
          )}
          {summary.strongest_topic && (
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">Strongest topic</p>
              <p className="text-sm font-medium text-gray-900">{summary.strongest_topic}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Recommendations ─────────────────────────────────────────────── */}
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
