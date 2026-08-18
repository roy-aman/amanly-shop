import { request, requestWithStatus, TokenStore } from '@/lib/http';
import type {
  AuthResponse,
  JoinPendingResponse,
  LoginResult,
  OtpChallengeResponse,
  RegisterResult,
} from '@/lib/types';

const P = '/api/v1/auth';

/**
 * Sign in. Two outcomes, distinguished by STATUS CODE rather than body shape:
 *
 *   200 → a session; tokens are stored and `kind` is `'session'`.
 *   202 → the account holds PLATFORM_ADMIN, so a password alone is not enough
 *         (their credential reaches every merchant). No tokens exist yet —
 *         finish with {@link verifyLoginOtp}.
 *
 * Ordinary customers never see 202, but the same form posts both, so callers
 * must handle each arm. See docs/platform-console-guide.md §2.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await requestWithStatus<AuthResponse | OtpChallengeResponse>('POST', `${P}/login`, {
    body: { email, password },
  });
  if (res.status === 202) {
    return { kind: 'otpRequired', challenge: res.data as OtpChallengeResponse };
  }
  const auth = res.data as AuthResponse;
  TokenStore.save(auth);
  return { kind: 'session', auth };
}

/**
 * Second step of a platform operator's sign-in.
 *
 * A wrong, expired or already-spent code all come back as `401 INVALID_OTP` —
 * identical on purpose, so do not try to tell the user which it was.
 */
export async function verifyLoginOtp(email: string, code: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>('POST', `${P}/login/verify-otp`, { body: { email, code } });
  TokenStore.save(data);
  return data;
}

/**
 * Create an account. Two outcomes, distinguished by STATUS CODE:
 *
 *   201 → a session; tokens are stored and `kind` is `'session'`.
 *   202 → the address is already registered elsewhere on the platform, so joining
 *         this store has to be confirmed from the emailed link. Nothing is created
 *         and NO tokens exist yet — finish at `/join-store`.
 */
export async function register(email: string, fullName: string, password: string): Promise<RegisterResult> {
  const res = await requestWithStatus<AuthResponse | JoinPendingResponse>('POST', `${P}/register`, {
    body: { email, fullName, password },
  });
  if (res.status === 202) {
    return { kind: 'joinPending', pending: res.data as JoinPendingResponse };
  }
  const auth = res.data as AuthResponse;
  TokenStore.save(auth);
  return { kind: 'session', auth };
}

/**
 * Exchange the token from the join confirmation email for a session at this store.
 *
 * The password was captured at registration and held with the token, so there is
 * nothing to collect here — the membership and the password are both created by
 * this call. The store comes from the token, not from where it is opened.
 */
export async function completeStoreJoin(token: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>('POST', `${P}/store-join/verify`, { body: { token } });
  TokenStore.save(data);
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = TokenStore.getRefreshToken();
  try {
    if (refreshToken) {
      await request<void>('POST', `${P}/logout`, { body: { refreshToken }, auth: true, retry: false });
    }
  } catch {
    // Ignore logout failures — always clear local state.
  } finally {
    TokenStore.clear();
  }
}

export function forgotPassword(email: string): Promise<void> {
  return request<void>('POST', `${P}/forgot-password`, { body: { email } });
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return request<void>('POST', `${P}/reset-password`, { body: { token, newPassword } });
}

export function resendEmailVerification(email: string): Promise<void> {
  return request<void>('POST', `${P}/email-verification/resend`, { body: { email } });
}

export function verifyEmail(token: string): Promise<void> {
  return request<void>('POST', `${P}/email-verification/verify`, { body: { token } });
}
