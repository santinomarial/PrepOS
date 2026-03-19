import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../api';

export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await auth.login(email, password);
      localStorage.setItem('token', data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <span className="font-mono text-2xl font-semibold tracking-widest text-accent">
            PREP<span className="text-primary">OS</span>
          </span>
          <p className="text-secondary text-sm mt-2">Interview prep, systematized.</p>
        </div>

        <div className="bg-surface border border-border p-8">
          <p className="text-xs font-mono text-secondary uppercase tracking-widest mb-6">
            Sign in
          </p>

          {error && (
            <div className="border border-danger/40 bg-danger/10 text-danger text-xs px-3 py-2 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-bg border border-border text-primary text-sm px-3 py-2.5 transition-colors duration-150"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-secondary uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-bg border border-border text-primary text-sm px-3 py-2.5 transition-colors duration-150"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 text-sm font-semibold bg-accent text-bg hover:bg-accent-dim disabled:opacity-50 transition-colors duration-150"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-xs text-secondary text-center mt-6">
            No account?{' '}
            <Link to="/register" className="text-accent hover:text-accent-dim transition-colors duration-150">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
