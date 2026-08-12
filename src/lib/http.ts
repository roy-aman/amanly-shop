/* ===================================================================
   Amanly — HTTP client
   Token storage, automatic access-token refresh, and typed errors.
   Ported from the original js/api.js so behavior matches the backend
   (Bearer JWT + refresh-token rotation).
   =================================================================== */

import type { AuthResponse, ErrorEnvelope, FieldViolation, UserResponse } from './types';

/**
 * Backend origin, baked in at build time from VITE_API_BASE_URL.
 *
 * Empty string = same origin, which is both the local-dev case (Vite proxies /api to :8080)
 * and the single-JAR deployment where Spring serves this bundle itself. When the frontend is
 * hosted separately, this becomes the API's absolute origin.
 *
 * Every call site keeps writing root-relative paths like '/api/v1/products'; only `apiUrl`
 * below knows about the origin. That is why splitting the frontend out did not require
 * touching the twenty-odd modules under src/api.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

/** Resolves a root-relative backend path against {@link API_BASE_URL}. */
export function apiUrl(path: string): string {
  // Absolute URLs pass through untouched — a caller that already knows its full target
  // (an image host, a payment gateway) must not get the API origin prepended.
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

const ACCESS_KEY = 'rc_access_token';
const REFRESH_KEY = 'rc_refresh_token';
const USER_KEY = 'rc_user';
const EXPIRES_KEY = 'rc_token_expires_at';
const ENTRY_KEY = 'rc_entry_point';

/**
 * Which door this session was opened through.
 *
 * A platform operator holds every store role at every store, so roles alone
 * cannot say whether they arrived to run the platform or to shop and help out
 * at this one shop. The entry point carries that intent: signing in on the
 * storefront gets the storefront and this store's console, nothing wider.
 *
 * It scopes what is OFFERED, not what is permitted — every /platform route is
 * enforced server-side regardless, so this is a matter of context rather than
 * a security boundary.
 */
export type EntryPoint = 'store' | 'platform';

export const TokenStore = {
  save(auth: AuthResponse) {
    localStorage.setItem(ACCESS_KEY, auth.accessToken);
    localStorage.setItem(REFRESH_KEY, auth.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
    localStorage.setItem(EXPIRES_KEY, String(Date.now() + auth.expiresInSeconds * 1000));
  },

  /** Set once at sign-in. Deliberately NOT written by `save`, which a token
   *  refresh also calls — a refresh must not silently change the context. */
  setEntryPoint(entry: EntryPoint) {
    localStorage.setItem(ENTRY_KEY, entry);
  },
  /** Defaults to 'store': a session restored from before this existed, or one
   *  from any other route, is the storefront's. */
  getEntryPoint(): EntryPoint {
    return localStorage.getItem(ENTRY_KEY) === 'platform' ? 'platform' : 'store';
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
    [ACCESS_KEY, REFRESH_KEY, USER_KEY, EXPIRES_KEY, ENTRY_KEY].forEach((k) => localStorage.removeItem(k));
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
      const res = await fetch(apiUrl('/api/v1/auth/refresh'), {
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

/** A successful response together with its status code. */
export interface ApiResult<T> {
  status: number;
  data: T;
}

/**
 * Like {@link request}, but hands back the HTTP status alongside the body.
 *
 * Needed wherever two different success codes mean two different things and the
 * body alone cannot be trusted to tell them apart — `POST /auth/login` answers
 * 200 with a session and 202 with an OTP challenge. Everything else should keep
 * using `request`, which discards the status.
 */
export async function requestWithStatus<T>(
  method: string,
  url: string,
  { body = null, auth = false, retry = true, signal }: RequestOptions = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  // FormData goes up untouched and WITHOUT a Content-Type: the browser writes its own multipart
  // header including the boundary token, and setting one here replaces it with a boundary-less
  // value the server cannot parse. Everything else is JSON exactly as before.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body != null && !isFormData) headers['Content-Type'] = 'application/json';

  if (auth) {
    if (retry && TokenStore.isExpired() && TokenStore.getRefreshToken()) {
      await silentRefresh();
    }
    const token = TokenStore.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(apiUrl(url), {
    method,
    headers,
    body: body != null ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
    signal,
  });

  if (res.status === 401 && auth && retry && TokenStore.getRefreshToken()) {
    if (await silentRefresh()) {
      return requestWithStatus<T>(method, url, { body, auth, retry: false, signal });
    }
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return { status: res.status, data: undefined as T };
  return { status: res.status, data: (await res.json()) as T };
}

export async function request<T>(method: string, url: string, options: RequestOptions = {}): Promise<T> {
  return (await requestWithStatus<T>(method, url, options)).data;
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
