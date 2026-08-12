import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { ThemeProvider } from '@/context/ThemeContext';
import StoreLayout from './StoreLayout';
import type { EntryPoint } from '@/lib/http';
import type { RoleName, UserResponse } from '@/lib/types';

/**
 * What the storefront account menu offers, per role.
 *
 * The case that needs pinning down: a platform operator is granted STAFF and
 * ADMIN inside every store, so role alone cannot decide whether to offer them
 * the platform console. The door they signed in through does.
 */
const authState = {
  roles: [] as RoleName[],
  via: 'store' as EntryPoint,
};

function user(roles: RoleName[]): UserResponse {
  return {
    id: 'u1',
    email: 'person@example.com',
    fullName: 'Royal Admin',
    provider: 'LOCAL',
    status: 'ACTIVE',
    roles,
    emailVerifiedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

vi.mock('@/context/AuthContext', async () => {
  // Real predicates, so this cannot drift from what the app actually decides.
  const actual = await vi.importActual<typeof import('@/context/AuthContext')>('@/context/AuthContext');
  return {
  ...actual,
  useAuth: () => {
    const has = (...r: RoleName[]) => r.some((x) => authState.roles.includes(x));
    const u = user(authState.roles);
    return {
      user: u,
      isAuthenticated: true,
      isStaff: actual.canManageStore(u),
      isAdmin: actual.isStoreAdmin(u),
      isPlatformAdmin: has('PLATFORM_ADMIN'),
      showsPlatformConsole: has('PLATFORM_ADMIN') && authState.via === 'platform',
      signedInVia: authState.via,
      logout: vi.fn(),
    };
  },
  };
});

vi.mock('@/context/CartContext', () => ({ useCart: () => ({ cart: null, itemCount: 0 }) }));
vi.mock('@/context/WishlistContext', () => ({ useWishlist: () => ({ count: 0 }) }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/api/store', () => ({
  getPublicStore: vi.fn().mockResolvedValue({
    slug: 'amanly',
    name: 'Amanly',
    currency: 'INR',
    codEnabled: true,
    onlinePaymentEnabled: true,
  }),
}));
vi.mock('@/api/catalog', () => ({ getCategoryTree: vi.fn().mockResolvedValue([]) }));

async function openMenu(roles: RoleName[], via: EntryPoint = 'store') {
  authState.roles = roles;
  authState.via = via;
  const u = userEvent.setup();
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ThemeProvider>
        <MemoryRouter>
          <StoreLayout />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  await u.click(screen.getByRole('button', { name: 'Account menu' }));
  return u;
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.roles = [];
  authState.via = 'store';
});

describe('Storefront account menu', () => {
  it('offers a shopper no way into any console', async () => {
    await openMenu([]);
    expect(await screen.findByRole('menuitem', { name: /account/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /manage store/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /platform console/i })).not.toBeInTheDocument();
  });

  it('has no Settings entry — name and password live on the profile page', async () => {
    await openMenu([]);
    await screen.findByRole('menuitem', { name: /account/i });
    expect(screen.queryByRole('menuitem', { name: /^settings$/i })).not.toBeInTheDocument();
  });

  it('drops Settings for staff and admins too', async () => {
    await openMenu(['ADMIN']);
    await screen.findByRole('menuitem', { name: /manage store/i });
    expect(screen.queryByRole('menuitem', { name: /^settings$/i })).not.toBeInTheDocument();
  });

  it('offers STAFF the store console, named for the store and their role', async () => {
    await openMenu(['STAFF']);
    const entry = await screen.findByRole('menuitem', { name: /manage store/i });
    expect(entry).toHaveAttribute('href', '/admin');
    expect(entry).toHaveTextContent('Amanly · Staff');
  });

  it('offers ADMIN the store console, labelled Admin', async () => {
    await openMenu(['ADMIN']);
    const entry = await screen.findByRole('menuitem', { name: /manage store/i });
    expect(entry).toHaveTextContent('Amanly · Admin');
  });

  /**
   * The rule that motivated the entry point. An operator holds ADMIN and STAFF at
   * every store, so a role-only test would hand them the platform console from the
   * storefront door — where they arrived to work on this one shop.
   */
  it('gives a platform operator who used the storefront door only this store', async () => {
    await openMenu(['CUSTOMER', 'STAFF', 'ADMIN', 'PLATFORM_ADMIN'], 'store');

    expect(await screen.findByRole('menuitem', { name: /manage store/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /platform console/i })).not.toBeInTheDocument();
  });

  it('offers both consoles when they came through the platform door', async () => {
    await openMenu(['CUSTOMER', 'STAFF', 'ADMIN', 'PLATFORM_ADMIN'], 'platform');

    expect(await screen.findByRole('menuitem', { name: /manage store/i })).toBeInTheDocument();
    const platform = screen.getByRole('menuitem', { name: /platform console/i });
    expect(platform).toHaveAttribute('href', '/platform');
    expect(platform).toHaveTextContent('Every store on the platform');
  });

  it('puts management above the shopping links, not buried under them', async () => {
    await openMenu(['ADMIN']);
    await screen.findByRole('menuitem', { name: /manage store/i });

    const items = screen.getAllByRole('menuitem').map((el) => (el.textContent ?? '').trim());
    const manage = items.findIndex((t) => t.startsWith('Manage store'));
    const account = items.findIndex((t) => t === 'Account');
    expect(manage).toBeGreaterThanOrEqual(0);
    expect(manage).toBeLessThan(account);
  });
});
