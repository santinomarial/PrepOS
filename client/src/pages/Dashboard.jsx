import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analytics, problems as problemsApi, recommend } from '../api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIFF_COLOR = {
  easy:   'text-accent',
  medium: 'text-warning',
  hard:   'text-danger',
};

function diffColor(d) {
  return DIFF_COLOR[d] ?? 'text-secondary';
}

/** Map weakness [0..1] to a css color string on the green→red scale. */
function heatStyle(score) {
  if (score == null) return { bg: '#1e1e2e', text: '#6b6b80' };
  if (score >= 0.75) return { bg: '#ff456022', text: '#ff4560' };
  if (score >= 0.55) return { bg: '#ffb80022', text: '#ffb800' };
  if (score >= 0.35) return { bg: '#ffb80011', text: '#e8c44a' };
  if (score >= 0.20) return { bg: '#00ff8815', text: '#00cc6a' };
  return                    { bg: '#00ff8822', text: '#00ff88' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value }) {
  return (
    <div className="bg-surface border border-border p-5">
      <p className="text-xs font-mono text-secondary uppercase tracking-widest mb-3">{label}</p>
      <p className="font-mono text-3xl font-semibold text-primary">{value ?? '—'}</p>
    </div>
  );
}

function RecommendCard({ rec }) {
  return (
    <Link
      to={`/problems/${rec.problem_id}`}
      className="block bg-surface border border-border border-l-2 border-l-accent px-4 py-3 hover:bg-border transition-colors duration-150"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary truncate">{rec.title}</p>
          {rec.topic && (
            <p className="text-xs font-mono text-secondary mt-0.5">{rec.topic}</p>
          )}
          <p className="text-xs text-secondary mt-1.5 leading-relaxed">{rec.reason}</p>
        </div>
        {rec.difficulty && (
          <span className={`shrink-0 text-xs font-mono font-medium mt-0.5 ${diffColor(rec.difficulty)}`}>
            {rec.difficulty.toUpperCase()}
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
      <p className="text-xs font-mono text-secondary uppercase tracking-widest mb-4">
        Topic mastery
      </p>
      <div className="flex flex-wrap gap-2">
        {topics.map((t) => {
          const { bg, text } = heatStyle(t.weakness_score);
          const mastery = Math.round((1 - t.weakness_score) * 100);
          return (
            <div
              key={t.topic}
              title={`${t.topic} · ${mastery}% mastery · ${t.total_attempts} attempts`}
              style={{ backgroundColor: bg, color: text, borderColor: text + '33' }}
              className="border px-3 py-2 cursor-default select-none transition-transform duration-150 hover:scale-105"
            >
              <span className="block text-xs font-medium">{t.topic}</span>
              <span className="block text-xs font-mono mt-0.5 opacity-80">{mastery}%</span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs font-mono text-secondary">WEAK</span>
        <div className="flex gap-px">
          {['#ff456033','#ffb80033','#ffb80020','#00ff8820','#00ff8833'].map((c, i) => (
            <div key={i} className="w-6 h-1.5" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span className="text-xs font-mono text-secondary">STRONG</span>
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
      <p className="text-xs font-mono text-secondary uppercase tracking-widest mb-4">
        Needs work
      </p>
      <div className="space-y-px">
        {bottom3.map((t) => {
          const mastery = Math.round((1 - t.weakness_score) * 100);
          const successPct = t.success_rate != null ? Math.round(t.success_rate * 100) : null;
          const avgTime = t.avg_time_minutes != null ? Math.round(t.avg_time_minutes) : null;
          return (
            <div key={t.topic} className="bg-surface border border-border px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">{t.topic}</p>
                <div className="flex items-center gap-3 mt-1">
                  {successPct != null && (
                    <span className="text-xs font-mono text-secondary">{successPct}% success</span>
                  )}
                  {avgTime != null && (
                    <span className="text-xs font-mono text-secondary">avg {avgTime}m</span>
                  )}
                  <span className="text-xs font-mono text-secondary">{t.total_attempts} attempts</span>
                </div>
              </div>
              <div className="shrink-0 w-24">
                <div className="h-px bg-border">
                  <div
                    className="h-px bg-accent transition-all duration-150"
                    style={{ width: `${mastery}%` }}
                  />
                </div>
                <p className="text-xs font-mono text-accent text-right mt-1">{mastery}%</p>
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
  const [summary,  setSummary]  = useState(null);
  const [dueCount, setDueCount] = useState(null);
  const [recs,     setRecs]     = useState([]);
  const [topics,   setTopics]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

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
        setTopics(weak.topics ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-xs font-mono text-secondary uppercase tracking-widest animate-pulse">
          Loading…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-xs font-mono text-danger">{error}</p>
      </div>
    );
  }

  const successPct = summary
    ? Math.round((summary.avg_success_rate ?? 0) * 100)
    : null;

  return (
    <div className="p-8 max-w-3xl">
      <p className="text-xs font-mono text-secondary uppercase tracking-widest mb-8">
        Dashboard
      </p>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mb-8 border border-border">
        <StatCard label="Problems"     value={summary?.total_problems} />
        <StatCard label="Due today"    value={dueCount} />
        <StatCard label="Streak"       value={summary ? `${summary.current_streak_days}d` : null} />
        <StatCard label="Success rate" value={successPct != null ? `${successPct}%` : null} />
      </div>

      {/* ── Heatmap ─────────────────────────────────────────────────────── */}
      <TopicHeatmap topics={topics} />

      {/* ── Weaknesses ──────────────────────────────────────────────────── */}
      <WeaknessesPanel topics={topics} />

      {/* ── Recommendations ─────────────────────────────────────────────── */}
      <p className="text-xs font-mono text-secondary uppercase tracking-widest mb-4">
        Recommended now
      </p>

      {recs.length === 0 ? (
        <div className="bg-surface border border-border px-4 py-8 text-center">
          <p className="text-sm text-secondary">No recommendations yet.</p>
          <p className="text-xs font-mono text-secondary mt-1 opacity-60">
            Add problems and log attempts to get suggestions.
          </p>
          <Link
            to="/problems"
            className="mt-4 inline-block text-xs font-mono text-accent hover:text-accent-dim transition-colors duration-150"
          >
            → Go to Problems
          </Link>
        </div>
      ) : (
        <div className="space-y-px">
          {recs.map((rec) => (
            <RecommendCard key={rec.problem_id} rec={rec} />
          ))}
        </div>
      )}
    </div>
  );
}
