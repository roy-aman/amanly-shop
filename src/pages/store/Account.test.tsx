import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import Account from './Account';
import { listOrders } from '@/api/orders';
import { updatePassword, updateProfile } from '@/api/users';
import { ApiError } from '@/lib/http';
import type { RoleName, UserResponse } from '@/lib/types';

vi.mock('@/api/orders', () => ({ listOrders: vi.fn() }));
vi.mock('@/api/users', () => ({ updateProfile: vi.fn(), updatePassword: vi.fn() }));

const setUser = vi.fn();
const authState = { roles: [] as RoleName[] };

function user(roles: RoleName[]): UserResponse {
  return {
    id: 'u1',
    email: 'aman@example.com',
    fullName: 'Aman Raj',
    provider: 'LOCAL',
    status: 'ACTIVE',
    roles,
    emailVerifiedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

vi.mock('@/context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('@/context/AuthContext')>('@/context/AuthContext');
  return {
    ...actual,
    useAuth: () => {
      const u = user(authState.roles);
      return {
        user: u,
        isStaff: actual.canManageStore(u),
        isAdmin: actual.isStoreAdmin(u),
        isPlatformAdmin: actual.hasRole(u, 'PLATFORM_ADMIN'),
        setUser,
      };
    },
  };
});

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() };
vi.mock('@/context/ToastContext', () => ({ useToast: () => toast }));

const profileMock = vi.mocked(updateProfile);
const passwordMock = vi.mocked(updatePassword);

beforeEach(() => {
  vi.clearAllMocks();
  authState.roles = [];
  vi.mocked(listOrders).mockResolvedValue({
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: 3,
    first: true,
    last: true,
    numberOfElements: 0,
    empty: true,
  });
  profileMock.mockResolvedValue(user([]));
});

/** Name and password belong to the person, not to their role, so every role gets them. */
const EVERY_ROLE: { label: string; roles: RoleName[] }[] = [
  { label: 'a shopper', roles: [] },
  { label: 'a customer', roles: ['CUSTOMER'] },
  { label: 'staff', roles: ['CUSTOMER', 'STAFF'] },
  { label: 'an admin', roles: ['CUSTOMER', 'STAFF', 'ADMIN'] },
  { label: 'a platform operator', roles: ['PLATFORM_ADMIN'] },
];

describe('Profile section', () => {
  it.each(EVERY_ROLE)('offers name and password to $label', async ({ roles }) => {
    authState.roles = roles;
    renderWithProviders(<Account />);

    expect(await screen.findByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
  });

  it('saves a new name and pushes it into the session', async () => {
    profileMock.mockResolvedValue({ ...user([]), fullName: 'Aman R' });
    const u = userEvent.setup();
    renderWithProviders(<Account />);

    const name = await screen.findByLabelText('Full name');
    await u.clear(name);
    await u.type(name, 'Aman R');
    await u.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() => expect(profileMock).toHaveBeenCalledWith('Aman R'));
    // Without this the header greeting and the account menu keep the old name.
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Aman R' })));
  });

  it('keeps Save inert until the name actually changes', async () => {
    renderWithProviders(<Account />);
    await screen.findByLabelText('Full name');
    expect(screen.getByRole('button', { name: 'Save name' })).toBeDisabled();
  });

  it('leaves email read-only', async () => {
    renderWithProviders(<Account />);
    expect(await screen.findByLabelText('Email')).toBeDisabled();
  });

  it('changes the password and clears the fields afterwards', async () => {
    passwordMock.mockResolvedValue(undefined);
    const u = userEvent.setup();
    renderWithProviders(<Account />);

    await u.type(await screen.findByLabelText('Current password'), 'OldPass#12345');
    await u.type(screen.getByLabelText('New password'), 'NewPass#12345');
    await u.type(screen.getByLabelText('Confirm new password'), 'NewPass#12345');
    await u.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => expect(passwordMock).toHaveBeenCalledWith('OldPass#12345', 'NewPass#12345'));
    await waitFor(() => expect(screen.getByLabelText('New password')).toHaveValue(''));
  });

  it('catches a mismatched confirmation before calling the API', async () => {
    const u = userEvent.setup();
    renderWithProviders(<Account />);

    await u.type(await screen.findByLabelText('Current password'), 'OldPass#12345');
    await u.type(screen.getByLabelText('New password'), 'NewPass#12345');
    await u.type(screen.getByLabelText('Confirm new password'), 'Different#12345');
    await u.click(screen.getByRole('button', { name: 'Update password' }));

    expect(passwordMock).not.toHaveBeenCalled();
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  });

  it('quotes the rule the backend actually enforces', async () => {
    renderWithProviders(<Account />);
    // The old copy said "at least 8 characters, including a letter and a number",
    // which earns a 400 the user cannot account for.
    expect(await screen.findByText(/at least 12 characters/i)).toBeInTheDocument();
  });

  it('maps server-side field errors onto the password fields', async () => {
    passwordMock.mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'Invalid', [{ field: 'currentPassword', message: 'Wrong password' }]),
    );
    const u = userEvent.setup();
    renderWithProviders(<Account />);

    await u.type(await screen.findByLabelText('Current password'), 'WrongPass#123');
    await u.type(screen.getByLabelText('New password'), 'NewPass#12345');
    await u.type(screen.getByLabelText('Confirm new password'), 'NewPass#12345');
    await u.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Wrong password')).toBeInTheDocument();
  });
});

describe('Account navigation', () => {
  it('no longer points at a separate settings page', async () => {
    renderWithProviders(<Account />);
    await screen.findByLabelText('Full name');
    expect(screen.queryByRole('link', { name: /settings/i })).not.toBeInTheDocument();
  });

  it('shows a shopper no management links', async () => {
    renderWithProviders(<Account />);
    await screen.findByLabelText('Full name');
    expect(screen.queryByText('Manage')).not.toBeInTheDocument();
  });

  it('shows an admin the console, team and store settings', async () => {
    authState.roles = ['CUSTOMER', 'STAFF', 'ADMIN'];
    renderWithProviders(<Account />);
    await screen.findByLabelText('Full name');

    expect(screen.getByRole('link', { name: /admin console/i })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: /team & users/i })).toHaveAttribute('href', '/admin/users');
    expect(screen.getByRole('link', { name: /store settings/i })).toHaveAttribute('href', '/admin/settings');
  });

  it('shows staff the console but not the ADMIN-only sections', async () => {
    authState.roles = ['CUSTOMER', 'STAFF'];
    renderWithProviders(<Account />);
    await screen.findByLabelText('Full name');

    expect(screen.getByRole('link', { name: /admin console/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /team & users/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /store settings/i })).not.toBeInTheDocument();
  });

  it('treats a platform operator as an administrator of this store', async () => {
    authState.roles = ['PLATFORM_ADMIN'];
    renderWithProviders(<Account />);
    await screen.findByLabelText('Full name');

    // The API serves them every admin endpoint here, so the UI must not pretend
    // otherwise (roles-and-permissions.md §6).
    expect(screen.getByRole('link', { name: /admin console/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /store settings/i })).toBeInTheDocument();
  });
});
