import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { problems as problemsApi } from '../api';

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

const COLUMNS = [
  { key: 'title',             label: 'Title',          sortable: true },
  { key: 'topic',             label: 'Topic',          sortable: true },
  { key: 'difficulty',        label: 'Difficulty',     sortable: true },
  { key: 'success_rate',      label: 'Success',        sortable: true },
  { key: 'last_attempted_at', label: 'Last attempted', sortable: true },
];

const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 };

function sortProblems(problems, key, dir) {
  return [...problems].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (key === 'difficulty') { av = DIFFICULTY_ORDER[av] ?? 99; bv = DIFFICULTY_ORDER[bv] ?? 99; }
    else if (key === 'last_attempted_at') { av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0; }
    else if (key === 'success_rate') { av = av ?? -1; bv = bv ?? -1; }
    else { av = (av ?? '').toString().toLowerCase(); bv = (bv ?? '').toString().toLowerCase(); }
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

// ── Input / Select shared styles ─────────────────────────────────────────────

const inputCls =
  'bg-bg border border-border text-primary text-sm px-3 py-1.5 transition-colors duration-150 placeholder:text-secondary/50';

const selectCls =
  'bg-bg border border-border text-primary text-sm px-3 py-1.5 transition-colors duration-150';

// ── Add Problem Modal ─────────────────────────────────────────────────────────

const EMPTY = { title: '', url: '', topic: '', difficulty: '', tags: '', notes: '' };

function AddProblemModal({ onClose, onCreated }) {
  const [form,    setForm]    = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const firstRef = useRef(null);

  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await problemsApi.create({
        title:      form.title.trim(),
        url:        form.url.trim()   || null,
        topic:      form.topic.trim() || null,
        difficulty: form.difficulty   || null,
        tags:       form.tags.trim()  || null,
        notes:      form.notes.trim() || null,
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const fieldCls = `w-full ${inputCls}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-surface border border-border w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-mono text-secondary uppercase tracking-widest">
            Add problem
          </p>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary text-lg leading-none transition-colors duration-150"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="border border-danger/40 bg-danger/10 text-danger text-xs px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-1.5">
              Title <span className="text-danger">*</span>
            </label>
            <input ref={firstRef} required value={form.title} onChange={set('title')}
              placeholder="e.g. Two Sum" className={fieldCls} />
          </div>

          <div>
            <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-1.5">
              URL
            </label>
            <input type="url" value={form.url} onChange={set('url')}
              placeholder="https://leetcode.com/problems/…" className={fieldCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-1.5">
                Topic
              </label>
              <input value={form.topic} onChange={set('topic')}
                placeholder="e.g. arrays" className={fieldCls} />
            </div>
            <div>
              <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-1.5">
                Difficulty
              </label>
              <select value={form.difficulty} onChange={set('difficulty')}
                className={`w-full ${selectCls}`}>
                <option value="">—</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-1.5">
              Tags
            </label>
            <input value={form.tags} onChange={set('tags')}
              placeholder="e.g. hash-map, two-pointer" className={fieldCls} />
          </div>

          <div>
            <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-1.5">
              Notes
            </label>
            <textarea value={form.notes} onChange={set('notes')} rows={2}
              placeholder="Optional notes…"
              className={`${fieldCls} resize-none`} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-secondary hover:text-primary transition-colors duration-150">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm font-semibold bg-accent text-bg hover:bg-accent-dim disabled:opacity-50 transition-colors duration-150">
              {loading ? 'Adding…' : 'Add problem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
  const [showModal,   setShowModal]   = useState(false);

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
    setTopic(''); setDifficulty(''); setTag(''); setSearch('');
    fetchProblems();
  }

  function handleSort(key) {
    if (key === sortKey) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

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
    if (col !== sortKey) return <span className="ml-1 text-border">↕</span>;
    return <span className="ml-1 text-accent">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <p className="text-xs font-mono text-secondary uppercase tracking-widest">Problems</p>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-sm font-semibold bg-accent text-bg hover:bg-accent-dim transition-colors duration-150"
        >
          + Add problem
        </button>
      </div>

      {showModal && (
        <AddProblemModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchProblems(); }}
        />
      )}

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSearch}
        className="bg-surface border border-border px-4 py-3 mb-4 flex flex-wrap gap-2 items-end"
      >
        <div>
          <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-1.5">Search</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="title or topic…" className={`${inputCls} w-40`} />
        </div>
        <div>
          <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-1.5">Topic</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. arrays" className={`${inputCls} w-32`} />
        </div>
        <div>
          <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-1.5">Difficulty</label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={selectCls}>
            <option value="">Any</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-1.5">Tag</label>
          <input value={tag} onChange={(e) => setTag(e.target.value)}
            placeholder="e.g. hash-map" className={`${inputCls} w-32`} />
        </div>
        <div className="flex gap-2">
          <button type="submit"
            className="px-3 py-1.5 text-sm font-semibold bg-accent text-bg hover:bg-accent-dim transition-colors duration-150">
            Filter
          </button>
          <button type="button" onClick={handleReset}
            className="px-3 py-1.5 text-sm text-secondary hover:text-primary transition-colors duration-150">
            Reset
          </button>
        </div>
      </form>

      {/* ── States ──────────────────────────────────────────────────────── */}
      {loading && (
        <p className="text-xs font-mono text-secondary uppercase tracking-widest animate-pulse py-4">
          Loading…
        </p>
      )}
      {error && <p className="text-xs font-mono text-danger py-4">{error}</p>}

      {!loading && !error && allProblems.length === 0 && (
        <div className="bg-surface border border-border px-4 py-10 text-center">
          <p className="text-sm text-secondary">No problems found.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 text-xs font-mono text-accent hover:text-accent-dim transition-colors duration-150"
          >
            → Add your first problem
          </button>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {!loading && !error && allProblems.length > 0 && (
        <>
          <div className="bg-surface border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={`px-4 py-3 text-left text-xs font-mono text-secondary uppercase tracking-widest select-none ${
                        col.sortable ? 'cursor-pointer hover:text-primary transition-colors duration-150' : ''
                      }`}
                    >
                      {col.label}
                      {col.sortable && <SortIcon col={col.key} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((p, i) => {
                  const isOverdue = p.next_review_date && new Date(p.next_review_date) <= new Date();
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/problems/${p.id}`)}
                      className={`cursor-pointer border-b border-border/50 hover:bg-border/40 transition-colors duration-150 ${
                        i % 2 === 0 ? '' : 'bg-bg/40'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-primary">{p.title}</span>
                        {isOverdue && (
                          <span className="ml-2 text-xs font-mono text-danger">OVERDUE</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-secondary">{p.topic ?? '—'}</td>
                      <td className="px-4 py-3">
                        {p.difficulty
                          ? <span className={`text-xs font-mono font-medium ${diffColor(p.difficulty)}`}>{p.difficulty.toUpperCase()}</span>
                          : <span className="text-secondary">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-secondary">
                        {p.success_rate != null ? `${Math.round(p.success_rate)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-secondary">
                        {formatDate(p.last_attempted_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs font-mono text-secondary mt-2">
            {visible.length} / {allProblems.length} problems
          </p>
        </>
      )}
    </div>
  );
}
