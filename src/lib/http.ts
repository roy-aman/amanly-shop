/* ===================================================================
   Royal Commerce — HTTP client
   Token storage, automatic access-token refresh, and typed errors.
   Ported from the original js/api.js so behavior matches the backend
   (Bearer JWT + refresh-token rotation).
   =================================================================== */

import type { AuthResponse, ErrorEnvelope, FieldViolation, UserResponse } from './types';

const ACCESS_KEY = 'rc_access_token';
const REFRESH_KEY = 'rc_refresh_token';
const USER_KEY = 'rc_user';
const EXPIRES_KEY = 'rc_token_expires_at';

export const TokenStore = {
  save(auth: AuthResponse) {
    localStorage.setItem(ACCESS_KEY, auth.accessToken);
    localStorage.setItem(REFRESH_KEY, auth.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
    localStorage.setItem(EXPIRES_KEY, String(Date.now() + auth.expiresInSeconds * 1000));
  },
  getAccessToken: () => localStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  getUser(): UserResponse | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserResponse) : null;
  },
  setUser(user: UserResponse) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  isExpired(): boolean {
    const at = parseInt(localStorage.getItem(EXPIRES_KEY) ?? '0', 10);
    return Date.now() >= at - 30_000; // 30s early for safety
  },
  isAuthenticated: () => !!localStorage.getItem(ACCESS_KEY),
  clear() {
    [ACCESS_KEY, REFRESH_KEY, USER_KEY, EXPIRES_KEY].forEach((k) => localStorage.removeItem(k));
  },
};

export class ApiError extends Error {
  status: number;
  code: string;
  fieldViolations: FieldViolation[];

  constructor(status: number, code: string, message: string, fieldViolations: FieldViolation[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldViolations = fieldViolations;
  }

  hasFieldErrors(): boolean {
    return this.fieldViolations.length > 0;
  }

  /** Field errors keyed by the trailing path segment (e.g. "shippingAddress.name" -> "name"). */
  fieldErrorMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const v of this.fieldViolations) {
      const key = String(v.field).split('.').pop() ?? v.field;
      if (!(key in map)) map[key] = v.message;
    }
    return map;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Partial<ErrorEnvelope>;
    return new ApiError(
      body.status ?? res.status,
      body.code ?? 'UNKNOWN',
      body.message ?? res.statusText,
      body.fieldViolations ?? [],
    );
  } catch {
    return new ApiError(res.status, 'UNKNOWN', res.statusText || 'An unexpected error occurred');
  }
}

interface RequestOptions {
  body?: unknown;
  auth?: boolean;
  retry?: boolean;
  signal?: AbortSignal;
}

let refreshPromise: Promise<boolean> | null = null;

// Called when refresh fails: clear session and let the app redirect to login.
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

async function silentRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = TokenStore.getRefreshToken();
      if (!refreshToken) return false;
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw await parseError(res);
      TokenStore.save((await res.json()) as AuthResponse);
      return true;
    } catch {
      TokenStore.clear();
      onSessionExpired?.();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function request<T>(
  method: string,
  url: string,
  { body = null, auth = false, retry = true, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body != null) headers['Content-Type'] = 'application/json';

  if (auth) {
    if (retry && TokenStore.isExpired() && TokenStore.getRefreshToken()) {
      await silentRefresh();
    }
    const token = TokenStore.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 401 && auth && retry && TokenStore.getRefreshToken()) {
    if (await silentRefresh()) {
      return request<T>(method, url, { body, auth, retry: false, signal });
    }
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function buildQuery(params: Record<string, unknown> = {}): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      usp.append(key, String(value));
    }
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}
