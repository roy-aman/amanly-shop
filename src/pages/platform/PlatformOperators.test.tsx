import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import PlatformOperators from './PlatformOperators';
import { platformAdmins } from '@/api/platform';
import { ApiError } from '@/lib/http';
import type { PlatformAdminResponse } from '@/lib/types';

vi.mock('@/api/platform', () => ({
  platformAdmins: { list: vi.fn(), grant: vi.fn(), revoke: vi.fn() },
}));
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() };
vi.mock('@/context/ToastContext', () => ({ useToast: () => toast }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', email: 'me@example.com', fullName: 'Me', roles: ['PLATFORM_ADMIN'] } }),
}));

const listMock = vi.mocked(platformAdmins.list);
const grantMock = vi.mocked(platformAdmins.grant);
const revokeMock = vi.mocked(platformAdmins.revoke);

function operator(overrides: Partial<PlatformAdminResponse> = {}): PlatformAdminResponse {
  return { userId: 'other', email: 'ops@example.com', fullName: 'Ops Person', since: '2026-01-01T00:00:00Z', ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([operator({ userId: 'me', email: 'me@example.com', fullName: 'Me' }), operator()]);
  grantMock.mockResolvedValue(operator());
  revokeMock.mockResolvedValue(undefined);
});

describe('Platform operators', () => {
  it('offers Revoke on other operators but never on your own row', async () => {
    renderWithProviders(<PlatformOperators />);
    await screen.findByText('ops@example.com');

    // The API refuses self-revocation; showing a button that always fails is worse
    // than not showing it.
    expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /revoke/i })).toHaveLength(1);
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('confirms before handing over every merchant on the platform', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlatformOperators />);
    await screen.findByText('ops@example.com');

    await user.type(screen.getByPlaceholderText('ops@example.com'), 'new.operator@example.com');
    await user.click(screen.getByRole('button', { name: /appoint/i }));

    expect(grantMock).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/manage every store/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Appoint' }));
    await waitFor(() => expect(grantMock).toHaveBeenCalledWith({ email: 'new.operator@example.com' }));
  });

  it('turns USER_NOT_FOUND into "ask them to sign up first"', async () => {
    grantMock.mockRejectedValue(new ApiError(404, 'USER_NOT_FOUND', 'User not found'));
    const user = userEvent.setup();
    renderWithProviders(<PlatformOperators />);
    await screen.findByText('ops@example.com');

    await user.type(screen.getByPlaceholderText('ops@example.com'), 'ghost@example.com');
    await user.click(screen.getByRole('button', { name: /appoint/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Appoint' }));

    expect(await screen.findByText(/ask them to sign up first/i)).toBeInTheDocument();
  });

  it('explains a self-revoke rejection instead of failing silently', async () => {
    revokeMock.mockRejectedValue(new ApiError(400, 'CANNOT_REVOKE_OWN_PLATFORM_ADMIN', 'nope'));
    const user = userEvent.setup();
    renderWithProviders(<PlatformOperators />);
    await screen.findByText('ops@example.com');

    await user.click(screen.getByRole('button', { name: /revoke/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /revoke access/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('You cannot revoke your own access', expect.any(String)),
    );
  });
});
