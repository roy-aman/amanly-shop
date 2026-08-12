import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import AdminLogin from './AdminLogin';
import type { AuthResponse, LoginResult, RoleName } from '@/lib/types';

/**
 * Console sign-in has to route three different kinds of account correctly, and
 * one of them (a platform operator) does not get a session from the first call.
 */
const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const login = vi.fn();
const verifyLoginOtp = vi.fn();
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ login, verifyLoginOtp }) }));

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() };
vi.mock('@/context/ToastContext', () => ({ useToast: () => toast }));

function auth(roles: RoleName[]): AuthResponse {
  return {
    tokenType: 'Bearer',
    accessToken: 'a',
    expiresInSeconds: 900,
    refreshToken: 'r',
    user: {
      id: 'u1',
      email: 'person@example.com',
      fullName: 'Person',
      provider: 'LOCAL',
      status: 'ACTIVE',
      roles,
      emailVerifiedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  };
}

const session = (roles: RoleName[]): LoginResult => ({ kind: 'session', auth: auth(roles) });

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('operator@amanly.in'), 'person@example.com');
  await user.type(screen.getByPlaceholderText('Enter your password'), 'Password#12345');
  await user.click(screen.getByRole('button', { name: /sign in to console/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Console sign-in', () => {
  // This door is for platform operators. Store staff and administrators belong on the storefront
  // sign-in, so arriving here does not hand them a console — it signs them in and sends them home,
  // where the account menu offers their admin console.

  it('sends STAFF to the storefront, not a console', async () => {
    login.mockResolvedValue(session(['STAFF']));
    const user = userEvent.setup();
    renderWithProviders(<AdminLogin />);
    await signIn(user);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }));
    expect(navigate).not.toHaveBeenCalledWith('/platform', { replace: true });
  });

  it('sends ADMIN to the storefront, not a console', async () => {
    login.mockResolvedValue(session(['ADMIN']));
    const user = userEvent.setup();
    renderWithProviders(<AdminLogin />);
    await signIn(user);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }));
    expect(navigate).not.toHaveBeenCalledWith('/platform', { replace: true });
  });

  it('signs a customer in rather than stranding a valid session', async () => {
    // The live backend returns [] rather than ['CUSTOMER'] for a plain shopper,
    // so "no console roles" is the real-world case, not a synthetic one.
    login.mockResolvedValue(session([]));
    const user = userEvent.setup();
    renderWithProviders(<AdminLogin />);
    await signIn(user);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }));
  });

  /**
   * The regression this guards. A platform operator is granted every store role at every store, so
   * their roles array always contains STAFF and ADMIN — a "has STAFF or ADMIN?" test matches them
   * first and lands them in a merchant's admin console instead of the platform one.
   */
  it('sends an operator who also carries store roles to the platform console', async () => {
    login.mockResolvedValue(session(['CUSTOMER', 'STAFF', 'ADMIN', 'PLATFORM_ADMIN']));
    const user = userEvent.setup();
    renderWithProviders(<AdminLogin />);
    await signIn(user);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/platform', { replace: true }));
  });

  it('shows the OTP step on 202 and signs nobody in until it is answered', async () => {
    login.mockResolvedValue({
      kind: 'otpRequired',
      challenge: { status: 'OTP_REQUIRED', message: 'We sent a code to your email.', otp: null },
    } satisfies LoginResult);
    verifyLoginOtp.mockResolvedValue(auth(['PLATFORM_ADMIN']));
    const user = userEvent.setup();
    renderWithProviders(<AdminLogin />);
    await signIn(user);

    expect(await screen.findByText(/extra step for platform operators/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText('123456'), '483920');
    await user.click(screen.getByRole('button', { name: /verify and sign in/i }));

    // The door is carried through the second step: finishing here puts the
    // session in platform context, which is what offers the platform console.
    await waitFor(() => expect(verifyLoginOtp).toHaveBeenCalledWith('person@example.com', '483920', 'platform'));
    // A platform operator lands in the platform console, not the store's admin —
    // they may hold no role at this store at all.
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/platform', { replace: true }));
  });

  it('keeps the code a real input, working when the API exposes none', async () => {
    login.mockResolvedValue({
      kind: 'otpRequired',
      challenge: { status: 'OTP_REQUIRED', message: 'Sent.', otp: null },
    } satisfies LoginResult);
    const user = userEvent.setup();
    renderWithProviders(<AdminLogin />);
    await signIn(user);

    const input = await screen.findByPlaceholderText('123456');
    expect(input).toHaveValue('');
    // Six digits required before the button arms.
    expect(screen.getByRole('button', { name: /verify and sign in/i })).toBeDisabled();
    await user.type(input, '12345');
    expect(screen.getByRole('button', { name: /verify and sign in/i })).toBeDisabled();
    await user.type(input, '6');
    expect(screen.getByRole('button', { name: /verify and sign in/i })).toBeEnabled();
  });

  it('prefills the dev-exposed code but labels it as dev only', async () => {
    login.mockResolvedValue({
      kind: 'otpRequired',
      challenge: { status: 'OTP_REQUIRED', message: 'Sent.', otp: '483920' },
    } satisfies LoginResult);
    const user = userEvent.setup();
    renderWithProviders(<AdminLogin />);
    await signIn(user);

    expect(await screen.findByPlaceholderText('123456')).toHaveValue('483920');
    expect(screen.getByText(/dev mode/i)).toBeInTheDocument();
  });

  it('an operator with no store role still reaches the platform console', async () => {
    login.mockResolvedValue(session(['PLATFORM_ADMIN']));
    const user = userEvent.setup();
    renderWithProviders(<AdminLogin />);
    await signIn(user);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/platform', { replace: true }));
  });
});
