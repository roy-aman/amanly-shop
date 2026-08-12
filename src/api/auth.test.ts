import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login, verifyLoginOtp } from './auth';
import { TokenStore } from '@/lib/http';
import type { AuthResponse } from '@/lib/types';

/**
 * The one place a 2xx does NOT mean "you are signed in". Getting this wrong
 * stores an undefined token and leaves a platform operator in a half-session,
 * so both arms are pinned here.
 */
function authResponse(): AuthResponse {
  return {
    tokenType: 'Bearer',
    accessToken: 'access-1',
    expiresInSeconds: 900,
    refreshToken: 'refresh-1',
    user: {
      id: 'u1',
      email: 'ops@example.com',
      fullName: 'Ops',
      provider: 'LOCAL',
      status: 'ACTIVE',
      roles: ['PLATFORM_ADMIN'],
      emailVerifiedAt: null,
      createdAt: '2026-08-09T00:00:00Z',
      updatedAt: '2026-08-09T00:00:00Z',
    },
  };
}

function respond(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

describe('login', () => {
  it('200 yields a session and stores the tokens', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, authResponse())));

    const result = await login('ops@example.com', 'pw');

    expect(result.kind).toBe('session');
    expect(TokenStore.getAccessToken()).toBe('access-1');
  });

  it('202 yields an OTP challenge and stores NOTHING', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respond(202, { status: 'OTP_REQUIRED', message: 'Enter the code', otp: null })),
    );

    const result = await login('ops@example.com', 'pw');

    expect(result.kind).toBe('otpRequired');
    // No session exists yet — a token written here would be `undefined`.
    expect(TokenStore.getAccessToken()).toBeNull();
    expect(TokenStore.isAuthenticated()).toBe(false);
  });

  it('does not mistake the dev-exposed code for a session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respond(202, { status: 'OTP_REQUIRED', message: 'Enter the code', otp: '483920' })),
    );

    const result = await login('ops@example.com', 'pw');

    expect(result.kind).toBe('otpRequired');
    if (result.kind === 'otpRequired') expect(result.challenge.otp).toBe('483920');
    expect(TokenStore.isAuthenticated()).toBe(false);
  });
});

describe('verifyLoginOtp', () => {
  it('completes the sign-in and stores the tokens', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, authResponse())));

    const auth = await verifyLoginOtp('ops@example.com', '483920');

    expect(auth.user.roles).toContain('PLATFORM_ADMIN');
    expect(TokenStore.getAccessToken()).toBe('access-1');
  });

  it('surfaces INVALID_OTP without storing anything', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respond(401, { status: 401, code: 'INVALID_OTP', message: 'Invalid code' })),
    );

    await expect(verifyLoginOtp('ops@example.com', '000000')).rejects.toMatchObject({ code: 'INVALID_OTP' });
    expect(TokenStore.isAuthenticated()).toBe(false);
  });
});
