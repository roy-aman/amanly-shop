import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { PageLoader } from './ui';

/** Requires any authenticated user. Redirects to /login, preserving intended path. */
export function RequireAuth() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Requires STAFF or ADMIN — access to the admin console. Redirects to /admin/login. */
export function RequireStaff() {
  const { isAuthenticated, isStaff, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (!isStaff) return <Navigate to="/admin/forbidden" replace />;
  return <Outlet />;
}

/** Requires ADMIN specifically (users/teams + store settings). */
export function RequireAdmin() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (!isAdmin) return <Navigate to="/admin/forbidden" replace />;
  return <Outlet />;
}
