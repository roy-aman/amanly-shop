import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import { RequireAdmin, RequireAuth, RequirePlatformAdmin, RequireStaff } from './guards';
import type { RoleName, UserResponse } from '@/lib/types';

/**
 * Who lands where. The four roles are checked against all four guards because
 * the failure that matters is the quiet one — a guard that lets the wrong role
 * through renders a console that 403s on every call.
 */
const authState = { user: null as UserResponse | null, loading: false };

vi.mock('@/context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('@/context/AuthContext')>('@/context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: authState.user,
      isAuthenticated: !!authState.user,
      // The REAL predicates, not a copy of them — a mock that restates the rule
      // it is meant to be testing passes no matter what the rule becomes.
      isStaff: actual.canManageStore(authState.user),
      isAdmin: actual.isStoreAdmin(authState.user),
      isPlatformAdmin: actual.hasRole(authState.user, 'PLATFORM_ADMIN'),
      loading: authState.loading,
    }),
  };
});

function user(roles: RoleName[]): UserResponse {
  return {
    id: 'u1',
    email: 'person@example.com',
    fullName: 'Person',
    provider: 'LOCAL',
    status: 'ACTIVE',
    roles,
    emailVerifiedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function renderGuard(Guard: () => JSX.Element, at = '/protected') {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route element={<Guard />}>
          <Route path="/protected" element={<div>PROTECTED CONTENT</div>} />
        </Route>
        <Route path="/login" element={<div>STOREFRONT LOGIN</div>} />
        <Route path="/admin/login" element={<div>CONSOLE LOGIN</div>} />
        <Route path="/admin/forbidden" element={<div>FORBIDDEN</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const CASES: { label: string; roles: RoleName[] | null }[] = [
  { label: 'signed out', roles: null },
  // The live backend hands a fresh customer an EMPTY roles array rather than
  // ['CUSTOMER'], so both spellings are covered — neither may reach a console.
  { label: 'customer (roles: [])', roles: [] },
  { label: 'customer (roles: [CUSTOMER])', roles: ['CUSTOMER'] },
  { label: 'staff', roles: ['STAFF'] },
  { label: 'admin', roles: ['ADMIN'] },
  { label: 'platform admin', roles: ['PLATFORM_ADMIN'] },
];

function setUser(roles: RoleName[] | null) {
  authState.user = roles === null ? null : user(roles);
  authState.loading = false;
}

describe('RequireAuth', () => {
  it.each(CASES)('$label', ({ roles }) => {
    setUser(roles);
    renderGuard(RequireAuth);
    if (roles === null) expect(screen.getByText('STOREFRONT LOGIN')).toBeInTheDocument();
    else expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument();
  });
});

// Staff and administrators belong to this store and sign in where its shoppers do, so a signed-out
// one is sent to the STOREFRONT login. Only the platform console sends people to /admin/login.
describe('RequireStaff', () => {
  it.each(CASES)('$label', ({ roles }) => {
    setUser(roles);
    renderGuard(RequireStaff);
    // A platform operator is granted every store role at every store, so the
    // server serves them these routes — the guard must not disagree with it.
    const allowed =
      roles?.includes('STAFF') || roles?.includes('ADMIN') || roles?.includes('PLATFORM_ADMIN');
    if (roles === null) expect(screen.getByText('STOREFRONT LOGIN')).toBeInTheDocument();
    else if (allowed) expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument();
    else expect(screen.getByText('FORBIDDEN')).toBeInTheDocument();
  });
});

describe('RequireAdmin', () => {
  it.each(CASES)('$label', ({ roles }) => {
    setUser(roles);
    renderGuard(RequireAdmin);
    if (roles === null) expect(screen.getByText('STOREFRONT LOGIN')).toBeInTheDocument();
    else if (roles.includes('ADMIN') || roles.includes('PLATFORM_ADMIN'))
      expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument();
    else expect(screen.getByText('FORBIDDEN')).toBeInTheDocument();
  });
});

describe('RequirePlatformAdmin', () => {
  it.each(CASES)('$label', ({ roles }) => {
    setUser(roles);
    renderGuard(RequirePlatformAdmin);
    if (roles === null) expect(screen.getByText('CONSOLE LOGIN')).toBeInTheDocument();
    else if (roles.includes('PLATFORM_ADMIN')) expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument();
    else expect(screen.getByText('FORBIDDEN')).toBeInTheDocument();
  });

  it('a platform operator reaches a merchant console, as the API already lets them', () => {
    setUser(['PLATFORM_ADMIN']);
    renderGuard(RequireStaff);
    expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument();
  });

  it('and reaches its ADMIN-only sections too', () => {
    setUser(['PLATFORM_ADMIN']);
    renderGuard(RequireAdmin);
    expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument();
  });

  it('a store ADMIN is NOT a platform operator', () => {
    setUser(['ADMIN']);
    renderGuard(RequirePlatformAdmin);
    expect(screen.getByText('FORBIDDEN')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED CONTENT')).not.toBeInTheDocument();
  });

  it('waits rather than bouncing while the session is still resolving', () => {
    authState.user = null;
    authState.loading = true;
    renderGuard(RequirePlatformAdmin);
    // A redirect here would throw a signed-in operator out on every hard refresh.
    expect(screen.queryByText('CONSOLE LOGIN')).not.toBeInTheDocument();
    expect(screen.queryByText('PROTECTED CONTENT')).not.toBeInTheDocument();
  });
});
