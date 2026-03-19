import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { problems as problemsApi, attempts as attemptsApi } from '../api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIFF_COLOR = {
  easy:   'text-accent',
  medium: 'text-warning',
  hard:   'text-danger',
};

function diffColor(d) { return DIFF_COLOR[d] ?? 'text-secondary'; }

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// ── Shared input style ────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-bg border border-border text-primary text-sm px-3 py-2 transition-colors duration-150 placeholder:text-secondary/50';

// ── Sub-components ────────────────────────────────────────────────────────────

function StatItem({ label, value, highlight }) {
  return (
    <div className="bg-surface border border-border px-4 py-3">
      <p className="text-xs font-mono text-secondary uppercase tracking-widest mb-1">{label}</p>
      <p className={`font-mono text-lg font-semibold ${highlight ? 'text-danger' : 'text-primary'}`}>
        {value ?? '—'}
      </p>
    </div>
  );
}

// ── Solve-time chart ──────────────────────────────────────────────────────────

function SolveTimeChart({ attempts }) {
  const data = [...attempts]
    .filter((a) => a.time_to_solve_minutes != null)
    .reverse()
    .map((a, i) => ({
      n: i + 1,
      time: a.time_to_solve_minutes,
      label: formatDateTime(a.attempted_at),
      solved: a.solved,
    }));

  if (data.length < 2) return null;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-surface border border-border px-3 py-2 text-xs font-mono">
        <p className="text-secondary">{d.label}</p>
        <p className="text-accent mt-0.5">{d.time}m — {d.solved ? 'solved' : 'not solved'}</p>
      </div>
    );
  };

  return (
    <div className="bg-surface border border-border px-4 py-4">
      <p className="text-xs font-mono text-secondary uppercase tracking-widest mb-4">
        Solve time trend (minutes)
      </p>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#1e1e2e" />
          <XAxis
            dataKey="n"
            tick={{ fontSize: 10, fill: '#6b6b80', fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={{ stroke: '#1e1e2e' }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b6b80', fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#1e1e2e' }} />
          <Line
            type="monotone"
            dataKey="time"
            stroke="#00ff88"
            strokeWidth={1.5}
            dot={{ r: 3, fill: '#00ff88', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#00ff88', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function Timeline({ attempts }) {
  if (attempts.length === 0) {
    return (
      <div className="bg-surface border border-border px-4 py-8 text-center">
        <p className="text-sm text-secondary">No attempts logged yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* vertical line */}
      <div className="absolute left-[8px] top-3 bottom-3 w-px bg-border" />

      <div className="space-y-3">
        {attempts.map((a) => (
          <div key={a.id} className="flex gap-4">
            {/* dot */}
            <div
              className="shrink-0 w-4 h-4 mt-1 border"
              style={{
                backgroundColor: a.solved ? '#00ff8820' : '#ff456020',
                borderColor:     a.solved ? '#00ff88'   : '#ff4560',
              }}
            />
            <div className="bg-surface border border-border px-4 py-3 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono font-medium ${a.solved ? 'text-accent' : 'text-danger'}`}>
                    {a.solved ? 'SOLVED' : 'FAILED'}
                  </span>
                  {a.time_to_solve_minutes != null && (
                    <span className="text-xs font-mono text-secondary">{a.time_to_solve_minutes}m</span>
                  )}
                </div>
                <span className="text-xs font-mono text-secondary">{formatDateTime(a.attempted_at)}</span>
              </div>
              {a.mistakes && (
                <p className="text-xs text-secondary mt-2 leading-relaxed border-t border-border/50 pt-2">
                  {a.mistakes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Log Attempt Form ──────────────────────────────────────────────────────────

function LogAttemptForm({ problemId, onLogged }) {
  const [solved,   setSolved]   = useState(false);
  const [time,     setTime]     = useState('');
  const [mistakes, setMistakes] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await attemptsApi.create(problemId, {
        solved,
        time_to_solve_minutes: time ? parseInt(time, 10) : null,
        mistakes: mistakes.trim() || null,
      });
      setSolved(false); setTime(''); setMistakes('');
      onLogged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border px-4 py-4 space-y-3">
      <p className="text-xs font-mono text-secondary uppercase tracking-widest">Log attempt</p>

      {error && (
        <div className="border border-danger/40 bg-danger/10 text-danger text-xs px-3 py-2">
          {error}
        </div>
      )}

      <label className="flex items-center gap-2.5 text-sm text-primary cursor-pointer select-none">
        <div
          onClick={() => setSolved((s) => !s)}
          className={`w-4 h-4 border flex items-center justify-center transition-colors duration-150 cursor-pointer ${
            solved ? 'border-accent bg-accent/20' : 'border-border'
          }`}
        >
          {solved && <span className="text-accent text-xs leading-none">✓</span>}
        </div>
        Solved
      </label>

      <div>
        <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-1.5">
          Time (minutes)
        </label>
        <input
          type="number" min="1" value={time} onChange={(e) => setTime(e.target.value)}
          placeholder="e.g. 20"
          className="bg-bg border border-border text-primary text-sm px-3 py-2 w-28 transition-colors duration-150 placeholder:text-secondary/50"
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-1.5">
          Mistakes / notes
        </label>
        <textarea
          value={mistakes} onChange={(e) => setMistakes(e.target.value)} rows={2}
          placeholder="Optional notes on what went wrong…"
          className={`${inputCls} resize-none`}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit" disabled={loading}
          className="px-4 py-2 text-sm font-semibold bg-accent text-bg hover:bg-accent-dim disabled:opacity-50 transition-colors duration-150"
        >
          {loading ? 'Saving…' : 'Save attempt'}
        </button>
      </div>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProblemDetail() {
  const { id } = useParams();
  const [problem, setProblem] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  async function load() {
    setError('');
    try {
      const [prob, hist] = await Promise.all([
        problemsApi.get(id),
        attemptsApi.forProblem(id),
      ]);
      setProblem(prob);
      setHistory(hist);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-xs font-mono text-secondary uppercase tracking-widest animate-pulse">Loading…</p>
      </div>
    );
  }
  if (error) return <div className="p-8 text-xs font-mono text-danger">{error}</div>;
  if (!problem) return null;

  const isOverdue = problem.next_review_date && new Date(problem.next_review_date) <= new Date();
  const successPct = problem.success_rate != null ? `${Math.round(problem.success_rate)}%` : null;

  return (
    <div className="p-8 max-w-5xl">
      {/* back */}
      <Link
        to="/problems"
        className="text-xs font-mono text-secondary hover:text-primary transition-colors duration-150 mb-6 inline-block"
      >
        ← Problems
      </Link>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-primary leading-tight">{problem.title}</h1>
          <div className="flex items-center gap-4 mt-2">
            {problem.topic && (
              <span className="text-xs font-mono text-secondary">{problem.topic}</span>
            )}
            {problem.difficulty && (
              <span className={`text-xs font-mono font-medium ${diffColor(problem.difficulty)}`}>
                {problem.difficulty.toUpperCase()}
              </span>
            )}
            {problem.url && (
              <a
                href={problem.url} target="_blank" rel="noopener noreferrer"
                className="text-xs font-mono text-accent hover:text-accent-dim transition-colors duration-150"
              >
                Open →
              </a>
            )}
          </div>
          {problem.tags && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {problem.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                <span key={t} className="text-xs font-mono bg-border/60 text-secondary px-2 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mb-8 border border-border">
        <StatItem label="Attempts"     value={problem.attempt_count} />
        <StatItem label="Success rate" value={successPct} />
        <StatItem
          label="Next review"
          value={problem.next_review_date
            ? isOverdue ? 'Overdue' : formatDate(problem.next_review_date)
            : 'Not scheduled'}
          highlight={isOverdue}
        />
        <StatItem label="Last attempt" value={formatDate(problem.last_attempted_at)} />
      </div>

      {/* ── Two-column layout: timeline left, chart + form right ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: timeline */}
        <div>
          <p className="text-xs font-mono text-secondary uppercase tracking-widest mb-4">
            Attempt history
          </p>
          <Timeline attempts={history} />
        </div>

        {/* Right: chart + log form */}
        <div className="space-y-6">
          <SolveTimeChart attempts={history} />
          <LogAttemptForm problemId={id} onLogged={load} />
        </div>
      </div>
    </div>
  );
}
