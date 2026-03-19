import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { problems as problemsApi, attempts as attemptsApi } from '../api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIFFICULTY_BADGE = {
  easy:   'bg-green-50  text-green-700',
  medium: 'bg-yellow-50 text-yellow-700',
  hard:   'bg-red-50    text-red-700',
};

function badge(difficulty) {
  return DIFFICULTY_BADGE[difficulty] ?? 'bg-gray-100 text-gray-600';
}

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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatItem({ label, value, highlight }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-red-600' : 'text-gray-900'}`}>
        {value ?? '—'}
      </p>
    </div>
  );
}

// ── Solve-time trend chart ────────────────────────────────────────────────────

function SolveTimeChart({ attempts }) {
  const data = [...attempts]
    .filter((a) => a.time_to_solve_minutes != null)
    .reverse()  // oldest first for the chart
    .map((a, i) => ({
      n: i + 1,
      time: a.time_to_solve_minutes,
      label: formatDateTime(a.attempted_at),
      solved: a.solved,
    }));

  if (data.length < 2) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-4 mb-6">
      <p className="text-xs font-medium text-gray-500 mb-3">Solve time trend (minutes)</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="n"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'attempt #', position: 'insideBottomRight', offset: 0, fontSize: 10, fill: '#d1d5db' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb', boxShadow: 'none' }}
            formatter={(val, _name, props) => [
              `${val}m — ${props.payload.solved ? 'solved' : 'not solved'}`,
              props.payload.label,
            ]}
            labelFormatter={() => ''}
          />
          <Line
            type="monotone"
            dataKey="time"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
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
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-6 text-center">
        <p className="text-sm text-gray-400">No attempts logged yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* vertical line */}
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gray-200" />

      <div className="space-y-4">
        {attempts.map((a) => (
          <div key={a.id} className="flex gap-4 relative">
            {/* dot */}
            <div
              className={`shrink-0 w-[18px] h-[18px] rounded-full border-2 mt-0.5 ${
                a.solved
                  ? 'bg-green-500 border-green-500'
                  : 'bg-white border-red-400'
              }`}
            />

            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium ${
                      a.solved ? 'text-green-700' : 'text-red-600'
                    }`}
                  >
                    {a.solved ? 'Solved' : 'Not solved'}
                  </span>
                  {a.time_to_solve_minutes != null && (
                    <span className="text-xs text-gray-400">· {a.time_to_solve_minutes}m</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{formatDateTime(a.attempted_at)}</span>
              </div>
              {a.mistakes && (
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{a.mistakes}</p>
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
  const [solved,    setSolved]    = useState(false);
  const [time,      setTime]      = useState('');
  const [mistakes,  setMistakes]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

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
      setSolved(false);
      setTime('');
      setMistakes('');
      onLogged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-lg px-4 py-4 space-y-3"
    >
      <p className="text-sm font-medium text-gray-700">Log attempt</p>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={solved}
          onChange={(e) => setSolved(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Solved
      </label>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Time (minutes)</label>
        <input
          type="number"
          min="1"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="e.g. 20"
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 w-28"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Mistakes / notes</label>
        <textarea
          value={mistakes}
          onChange={(e) => setMistakes(e.target.value)}
          rows={2}
          placeholder="Optional notes on what went wrong…"
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Saving…' : 'Save'}
      </button>
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

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  if (error)   return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!problem) return null;

  const isOverdue =
    problem.next_review_date && new Date(problem.next_review_date) <= new Date();

  const successPct =
    problem.success_rate != null ? `${Math.round(problem.success_rate)}%` : null;

  return (
    <div className="p-8 max-w-2xl">
      {/* back */}
      <Link
        to="/problems"
        className="inline-block text-xs text-gray-400 hover:text-gray-600 mb-5 transition-colors"
      >
        ← Problems
      </Link>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 leading-tight">
            {problem.title}
          </h1>
          {problem.topic && (
            <p className="text-sm text-gray-500 mt-0.5">{problem.topic}</p>
          )}
          {problem.url && (
            <a
              href={problem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline mt-1 inline-block"
            >
              Open problem →
            </a>
          )}
        </div>
        {problem.difficulty && (
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${badge(problem.difficulty)}`}>
            {problem.difficulty}
          </span>
        )}
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatItem label="Attempts"     value={problem.attempt_count} />
        <StatItem label="Success rate" value={successPct} />
        <StatItem
          label="Next review"
          value={
            problem.next_review_date
              ? isOverdue ? 'Overdue' : formatDate(problem.next_review_date)
              : 'Not scheduled'
          }
          highlight={isOverdue}
        />
        <StatItem label="Last attempt" value={formatDate(problem.last_attempted_at)} />
      </div>

      {/* ── Tags ────────────────────────────────────────────────────────── */}
      {problem.tags && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {problem.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
            <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* ── Solve time chart ────────────────────────────────────────────── */}
      <SolveTimeChart attempts={history} />

      {/* ── Log attempt ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <LogAttemptForm problemId={id} onLogged={load} />
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      <h2 className="text-sm font-medium text-gray-700 mb-3">Attempt history</h2>
      <Timeline attempts={history} />
    </div>
  );
}
