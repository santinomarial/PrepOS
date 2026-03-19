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
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <span className="text-base font-semibold tracking-tight">PrepOS</span>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-gray-500 rounded-md hover:bg-gray-100 hover:text-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
