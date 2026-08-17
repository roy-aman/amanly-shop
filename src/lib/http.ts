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
const STORE_SLUG_KEY = 'rc_store_slug';

/**
 * Which store this browser has learned it is talking to.
 *
 * One bundle serves every shop, and which shop is decided by the address it was loaded from — so
 * the slug is something the app is *told* on boot (`GET /api/v1/store`), not something it knows.
 * It is kept because it namespaces anything persisted per store, and because sending it back lets
 * the server catch the case where it has gone stale: a domain re-pointed at a different store
 * would otherwise leave a tab rendering one shop's name while reading and writing another's data.
 *
 * It is a claim, never an instruction. The server resolves the tenant from the request's origin
 * regardless of what this says, and answers 409 STORE_CONTEXT_STALE when the two disagree. Writing
 * a different slug in here therefore gains an attacker nothing.
 */
export const StoreScope = {
  get: () => localStorage.getItem(STORE_SLUG_KEY),
  set(slug: string) {
    localStorage.setItem(STORE_SLUG_KEY, slug);
  },
  clear() {
    localStorage.removeItem(STORE_SLUG_KEY);
  },
};

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
  /**
   * Whether to send the stored slug as `X-Store-Slug`. Defaults to true for anything
   * authenticated or non-GET; see {@link shouldClaimStore}.
   *
   * Set false for the bootstrap call that *learns* the slug — claiming a stale one on the very
   * request meant to correct it would 409 the only call that can recover.
   */
  claimStore?: boolean;
}

/**
 * Whether this request carries the store claim.
 *
 * Not every request: a custom header makes a request non-simple, and a preflight is cached per
 * path, so putting it on public catalogue GETs would add an OPTIONS round-trip for every distinct
 * product URL a shopper opens. Authenticated requests and non-GETs already preflight — an
 * `Authorization` header or a JSON body is enough on its own — so restricting the claim to those
 * costs nothing and still covers every request that can *change* data. What it gives up is
 * catching a stale slug during anonymous browsing, where the consequence is the wrong shop's
 * catalogue on screen rather than a write into the wrong shop.
 */
function shouldClaimStore(method: string, auth: boolean): boolean {
  return auth || method.toUpperCase() !== 'GET';
}

let refreshPromise: Promise<boolean> | null = null;

// Called when refresh fails: clear session and let the app redirect to login.
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

// Called when the server reports the stored slug is not the store this address serves, so the app
// can go and re-learn it. The failed request itself is retried without the claim, so this is about
// bringing the cached store back in step rather than rescuing the call.
let onStoreContextStale: (() => void) | null = null;
export function setStoreContextStaleHandler(fn: () => void) {
  onStoreContextStale = fn;
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
  { body = null, auth = false, retry = true, signal, claimStore }: RequestOptions = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  // FormData goes up untouched and WITHOUT a Content-Type: the browser writes its own multipart
  // header including the boundary token, and setting one here replaces it with a boundary-less
  // value the server cannot parse. Everything else is JSON exactly as before.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body != null && !isFormData) headers['Content-Type'] = 'application/json';

  if (claimStore ?? shouldClaimStore(method, auth)) {
    const slug = StoreScope.get();
    if (slug) headers['X-Store-Slug'] = slug;
  }

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
      return requestWithStatus<T>(method, url, { body, auth, retry: false, signal, claimStore });
    }
  }

  if (!res.ok) {
    const error = await parseError(res);
    // A stale claim is recoverable and must not surface to the user: drop it, let the server
    // resolve the tenant from the origin as it would have anyway, and separately go and re-learn
    // which store this address serves. Retried with the claim explicitly off, so a server that
    // somehow 409s again cannot put us in a loop.
    if (error.status === 409 && error.code === 'STORE_CONTEXT_STALE' && retry) {
      StoreScope.clear();
      onStoreContextStale?.();
      return requestWithStatus<T>(method, url, { body, auth, retry: false, signal, claimStore: false });
    }
    throw error;
  }
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
