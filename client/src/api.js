/**
 * api.js — thin wrapper around fetch that attaches the JWT and handles
 * common error cases uniformly.
 *
 * Every export group mirrors a FastAPI router:
 *   auth      → /auth/*
 *   problems  → /problems/*
 *   attempts  → /problems/{id}/attempts  (nested) + /attempts/* (flat)
 *   analytics → /analytics/*
 *   recommend → /recommend
 *
 * Configure the backend URL via VITE_API_URL in .env.local:
 *   VITE_API_URL=http://localhost:8000
 */

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

function getToken() {
  return localStorage.getItem('token');
}

/**
 * Core fetch wrapper.
 *
 * - Attaches Authorization header when a token is present.
 * - On 401 clears the token and redirects to /login (session expired).
 * - On 204 returns null (no body).
 * - On other non-OK status throws an Error with the API's detail message.
 */
async function request(path, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    // Caller may override Content-Type (e.g. form-encoded login).
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return;
  }

  if (res.status === 204) return null;

  if (!res.ok) {
    let detail = 'Request failed';
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  register: (email, password) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  /**
   * Login uses OAuth2 form encoding (username = email) so Swagger's Authorize
   * button and this client both work against the same endpoint.
   */
  login: (email, password) => {
    const form = new URLSearchParams({ username: email, password });
    return request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
  },

  me: () => request('/auth/me'),
};

// ── Problems ──────────────────────────────────────────────────────────────────

export const problems = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
    ).toString();
    return request(`/problems${qs ? `?${qs}` : ''}`);
  },

  get: (id) => request(`/problems/${id}`),

  create: (data) =>
    request('/problems', { method: 'POST', body: JSON.stringify(data) }),

  update: (id, data) =>
    request(`/problems/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id) =>
    request(`/problems/${id}`, { method: 'DELETE' }),

  due: () => request('/problems/due'),
};

// ── Attempts ──────────────────────────────────────────────────────────────────

export const attempts = {
  /** All attempts for a problem, newest first. */
  forProblem: (problemId) => request(`/problems/${problemId}/attempts`),

  /** Log a new attempt via the nested route. */
  create: (problemId, data) =>
    request(`/problems/${problemId}/attempts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Analytics ─────────────────────────────────────────────────────────────────

export const analytics = {
  summary: () => request('/analytics/summary'),
  weaknesses: () => request('/analytics/weaknesses'),
};

// ── Recommendations ───────────────────────────────────────────────────────────

export const recommend = {
  top: (n = 5) => request(`/recommend?top_n=${n}`),
};
