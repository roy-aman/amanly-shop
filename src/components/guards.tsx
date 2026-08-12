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

/**
 * Requires STAFF or ADMIN — access to the store's admin console. Sends a signed-out visitor to the
 * storefront sign-in, not to /admin/login: staff are members of this store and sign in exactly where
 * its shoppers do. /admin/login is the platform operators' door and would only mislead them.
 */
export function RequireStaff() {
  const { isAuthenticated, isStaff, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (!isStaff) return <Navigate to="/admin/forbidden" replace />;
  return <Outlet />;
}

/**
 * Requires PLATFORM_ADMIN — the platform console.
 *
 * The role is the gate, not the presence of a token: every /api/v1/platform/**
 * endpoint enforces it server-side and answers 403 regardless, so this only
 * decides whether a console that would 403 on every call gets rendered at all.
 * An operator is not a member of the store they signed in at, which is why this
 * cannot be folded into RequireStaff.
 */
export function RequirePlatformAdmin() {
  const { isAuthenticated, isPlatformAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (!isPlatformAdmin) return <Navigate to="/admin/forbidden" replace />;
  return <Outlet />;
}

/** Requires ADMIN specifically (users/teams + store settings). Signed-out visitors go to the
 *  storefront sign-in, for the same reason as {@link RequireStaff}. */
export function RequireAdmin() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (!isAdmin) return <Navigate to="/admin/forbidden" replace />;
  return <Outlet />;
}
