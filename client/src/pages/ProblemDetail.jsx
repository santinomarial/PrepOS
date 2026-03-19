import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatItem({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value ?? '—'}</p>
    </div>
  );
}

function AttemptRow({ attempt }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
            attempt.solved
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-600'
          }`}
        >
          {attempt.solved ? '✓' : '✗'}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{formatDateTime(attempt.attempted_at)}</p>
          {attempt.mistakes && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{attempt.mistakes}</p>
          )}
        </div>
      </div>
      {attempt.time_to_solve_minutes != null && (
        <span className="shrink-0 text-xs text-gray-500">{attempt.time_to_solve_minutes}m</span>
      )}
    </div>
  );
}

// ── Log Attempt Form ──────────────────────────────────────────────────────────

function LogAttemptForm({ problemId, onLogged }) {
  const [solved, setSolved]     = useState(false);
  const [time, setTime]         = useState('');
  const [mistakes, setMistakes] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

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

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={solved}
            onChange={(e) => setSolved(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Solved
        </label>
      </div>

      <div className="flex gap-3">
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
  const [problem, setProblem]   = useState(null);
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

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
      {/* ── Back link ──────────────────────────────────────────────────── */}
      <Link
        to="/problems"
        className="inline-block text-xs text-gray-400 hover:text-gray-600 mb-5 transition-colors"
      >
        ← Problems
      </Link>

      {/* ── Header ─────────────────────────────────────────────────────── */}
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

      {/* ── Stats grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatItem label="Attempts"     value={problem.attempt_count} />
        <StatItem label="Success rate" value={successPct} />
        <StatItem
          label="Next review"
          value={
            problem.next_review_date
              ? isOverdue
                ? 'Overdue'
                : formatDate(problem.next_review_date)
              : 'Not scheduled'
          }
        />
        <StatItem label="Last attempt" value={formatDate(problem.last_attempted_at)} />
      </div>

      {/* ── Tags ───────────────────────────────────────────────────────── */}
      {problem.tags && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {problem.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
            <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* ── Log new attempt ────────────────────────────────────────────── */}
      <div className="mb-6">
        <LogAttemptForm problemId={id} onLogged={load} />
      </div>

      {/* ── Attempt history ────────────────────────────────────────────── */}
      <h2 className="text-sm font-medium text-gray-700 mb-3">Attempt history</h2>

      {history.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-6 text-center">
          <p className="text-sm text-gray-400">No attempts logged yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg px-4 divide-y-0">
          {history.map((a) => (
            <AttemptRow key={a.id} attempt={a} />
          ))}
        </div>
      )}
    </div>
  );
}
