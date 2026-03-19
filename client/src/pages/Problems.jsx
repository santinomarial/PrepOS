import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { problems as problemsApi } from '../api';

const DIFFICULTY_BADGE = {
  easy:   'bg-green-50  text-green-700',
  medium: 'bg-yellow-50 text-yellow-700',
  hard:   'bg-red-50    text-red-700',
};

function badge(difficulty) {
  return DIFFICULTY_BADGE[difficulty] ?? 'bg-gray-100 text-gray-600';
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProblemRow({ problem }) {
  const isOverdue =
    problem.next_review_date && new Date(problem.next_review_date) <= new Date();

  return (
    <Link
      to={`/problems/${problem.id}`}
      className="block bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-indigo-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{problem.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {problem.topic && (
              <span className="text-xs text-gray-500">{problem.topic}</span>
            )}
            {problem.topic && problem.attempt_count > 0 && (
              <span className="text-gray-300 text-xs">·</span>
            )}
            {problem.attempt_count > 0 && (
              <span className="text-xs text-gray-500">
                {problem.attempt_count} attempt{problem.attempt_count !== 1 ? 's' : ''}
              </span>
            )}
            {problem.success_rate != null && (
              <>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-xs text-gray-500">
                  {Math.round(problem.success_rate)}% success
                </span>
              </>
            )}
            {problem.next_review_date && (
              <>
                <span className="text-gray-300 text-xs">·</span>
                <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                  {isOverdue ? 'Overdue' : `Due ${formatDate(problem.next_review_date)}`}
                </span>
              </>
            )}
          </div>
        </div>
        {problem.difficulty && (
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${badge(problem.difficulty)}`}>
            {problem.difficulty}
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Problems() {
  const [allProblems, setAllProblems] = useState([]);
  const [topic, setTopic]             = useState('');
  const [difficulty, setDifficulty]   = useState('');
  const [tag, setTag]                 = useState('');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  function fetchProblems(params = {}) {
    setLoading(true);
    setError('');
    problemsApi
      .list(params)
      .then(setAllProblems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchProblems();
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    fetchProblems({ topic, difficulty, tag });
  }

  function handleReset() {
    setTopic('');
    setDifficulty('');
    setTag('');
    fetchProblems();
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Problems</h1>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSearch}
        className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-5 flex flex-wrap gap-2 items-end"
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">Topic</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. arrays"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Any</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Tag</label>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="e.g. hash-map"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36"
          />
        </div>

        <div className="flex gap-2 items-center">
          <button
            type="submit"
            className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Search
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 text-sm text-gray-500 rounded-md hover:bg-gray-100 transition-colors"
          >
            Reset
          </button>
        </div>
      </form>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error   && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && allProblems.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-6 text-center">
          <p className="text-sm text-gray-400">No problems found.</p>
          <p className="text-xs text-gray-400 mt-1">
            Use the API (or Swagger at{' '}
            <code className="font-mono">localhost:8000/docs</code>) to add problems.
          </p>
        </div>
      )}

      {!loading && !error && allProblems.length > 0 && (
        <div className="space-y-2">
          {allProblems.map((p) => (
            <ProblemRow key={p.id} problem={p} />
          ))}
          <p className="text-xs text-gray-400 pt-1">
            {allProblems.length} problem{allProblems.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
