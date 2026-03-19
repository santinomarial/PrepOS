import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { problems as problemsApi } from '../api';

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

const COLUMNS = [
  { key: 'title',              label: 'Title',          sortable: true  },
  { key: 'topic',              label: 'Topic',          sortable: true  },
  { key: 'difficulty',         label: 'Difficulty',     sortable: true  },
  { key: 'success_rate',       label: 'Success',        sortable: true  },
  { key: 'last_attempted_at',  label: 'Last attempted', sortable: true  },
];

const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 };

function sortProblems(problems, key, dir) {
  return [...problems].sort((a, b) => {
    let av = a[key];
    let bv = b[key];

    if (key === 'difficulty') {
      av = DIFFICULTY_ORDER[av] ?? 99;
      bv = DIFFICULTY_ORDER[bv] ?? 99;
    } else if (key === 'last_attempted_at') {
      av = av ? new Date(av).getTime() : 0;
      bv = bv ? new Date(bv).getTime() : 0;
    } else if (key === 'success_rate') {
      av = av ?? -1;
      bv = bv ?? -1;
    } else {
      av = (av ?? '').toString().toLowerCase();
      bv = (bv ?? '').toString().toLowerCase();
    }

    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Problems() {
  const navigate = useNavigate();

  const [allProblems, setAllProblems] = useState([]);
  const [topic,       setTopic]       = useState('');
  const [difficulty,  setDifficulty]  = useState('');
  const [tag,         setTag]         = useState('');
  const [search,      setSearch]      = useState('');
  const [sortKey,     setSortKey]     = useState('title');
  const [sortDir,     setSortDir]     = useState('asc');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  function fetchProblems(params = {}) {
    setLoading(true);
    setError('');
    problemsApi
      .list(params)
      .then(setAllProblems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchProblems(); }, []);

  function handleSearch(e) {
    e.preventDefault();
    fetchProblems({ topic, difficulty, tag });
  }

  function handleReset() {
    setTopic('');
    setDifficulty('');
    setTag('');
    setSearch('');
    fetchProblems();
  }

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  // client-side text search + sort applied on top of server filter results
  const visible = sortProblems(
    search
      ? allProblems.filter((p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          (p.topic ?? '').toLowerCase().includes(search.toLowerCase()),
        )
      : allProblems,
    sortKey,
    sortDir,
  );

  function SortIcon({ col }) {
    if (col !== sortKey) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1 text-indigo-500">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Problems</h1>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSearch}
        className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-end"
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="title or topic…"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Topic</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. arrays"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32"
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
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32"
          />
        </div>

        <div className="flex gap-2 items-center">
          <button
            type="submit"
            className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Filter
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

      {/* ── States ─────────────────────────────────────────────────────── */}
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

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {!loading && !error && allProblems.length > 0 && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={`px-4 py-2.5 text-left text-xs font-medium text-gray-500 select-none ${
                        col.sortable ? 'cursor-pointer hover:text-gray-700' : ''
                      }`}
                    >
                      {col.label}
                      {col.sortable && <SortIcon col={col.key} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((p) => {
                  const isOverdue =
                    p.next_review_date && new Date(p.next_review_date) <= new Date();
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/problems/${p.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{p.title}</span>
                        {isOverdue && (
                          <span className="ml-2 text-xs text-red-500 font-medium">overdue</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{p.topic ?? '—'}</td>
                      <td className="px-4 py-3">
                        {p.difficulty ? (
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${badge(p.difficulty)}`}>
                            {p.difficulty}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {p.success_rate != null
                          ? `${Math.round(p.success_rate)}%`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(p.last_attempted_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 pt-2">
            {visible.length} of {allProblems.length} problem{allProblems.length !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  );
}
