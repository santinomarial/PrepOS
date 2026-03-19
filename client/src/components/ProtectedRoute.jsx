import { Navigate, Outlet } from 'react-router-dom';

/**
 * Renders child routes only when a JWT is present in localStorage.
 * On 401 responses api.js handles the redirect, so this guard is just
 * for the initial page load.
 */
export default function ProtectedRoute() {
  const token = localStorage.getItem('token');
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
