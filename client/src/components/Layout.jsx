import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/problems',  label: 'Problems'  },
];

export default function Layout() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-bg text-primary">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className="shrink-0 flex flex-col border-r border-border"
        style={{ width: 220 }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <span className="font-mono text-base font-semibold tracking-widest text-accent">
            PREP<span className="text-primary">OS</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'text-accent border-l-2 border-accent bg-accent/5 pl-[10px]'
                    : 'text-secondary hover:text-primary hover:bg-surface border-l-2 border-transparent pl-[10px]'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-secondary hover:text-danger transition-colors duration-150"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto grid-bg">
        <Outlet />
      </main>
    </div>
  );
}
