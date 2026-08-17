import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  request,
  buildQuery,
  setStoreContextStaleHandler,
  StoreScope,
  TokenStore,
} from './http';
import type { AuthResponse } from './types';

// ── ApiError ──────────────────────────────────────────────────────────
describe('ApiError', () => {
  it('carries status, code and message', () => {
    const err = new ApiError(422, 'VALIDATION', 'Invalid input');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(422);
    expect(err.code).toBe('VALIDATION');
    expect(err.message).toBe('Invalid input');
    expect(err.fieldViolations).toEqual([]);
  });

  it('reports absence/presence of field errors', () => {
    expect(new ApiError(400, 'X', 'x').hasFieldErrors()).toBe(false);
    const withFields = new ApiError(400, 'X', 'x', [{ field: 'email', message: 'required' }]);
    expect(withFields.hasFieldErrors()).toBe(true);
  });

  it('maps field violations by the trailing path segment, keeping the first', () => {
    const err = new ApiError(400, 'VALIDATION', 'bad', [
      { field: 'shippingAddress.name', message: 'Name required' },
      { field: 'email', message: 'Email required' },
      { field: 'billing.name', message: 'ignored duplicate' },
    ]);
    const map = err.fieldErrorMap();
    expect(map).toEqual({ name: 'Name required', email: 'Email required' });
    // trailing-segment collision keeps the first violation, not the later one
    expect(map.name).toBe('Name required');
  });
});

// ── buildQuery ────────────────────────────────────────────────────────
describe('buildQuery', () => {
  it('returns empty string when there are no meaningful params', () => {
    expect(buildQuery({})).toBe('');
    expect(buildQuery({ a: undefined, b: null, c: '' })).toBe('');
  });

  it('serializes only defined, non-empty values', () => {
    expect(buildQuery({ page: 0, size: 20, search: '', tag: undefined })).toBe('?page=0&size=20');
  });
});

// ── request ───────────────────────────────────────────────────────────
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request', () => {
  it('resolves the parsed JSON body on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: '1', name: 'Widget' }));
    const data = await request<{ id: string; name: string }>('GET', '/api/v1/products/1');
    expect(data).toEqual({ id: '1', name: 'Widget' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/products/1');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('sends a JSON body with the Content-Type header when a body is provided', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await request('POST', '/api/v1/things', { body: { a: 1 } });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('returns undefined on 204 No Content without parsing a body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await request('DELETE', '/api/v1/things/1');
    expect(result).toBeUndefined();
  });

  it('throws a typed ApiError built from the error envelope on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { status: 409, code: 'CONFLICT', message: 'Already exists', fieldViolations: [] },
        409,
      ),
    );
    await expect(request('POST', '/api/v1/things')).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'CONFLICT',
      message: 'Already exists',
    });
  });

  it('does not attach an Authorization header when auth is not requested', async () => {
    localStorage.setItem('rc_access_token', 'tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await request('GET', '/api/v1/public');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('on 401 refreshes the token and retries the original request once', async () => {
    // Not-yet-expired token so the pre-emptive refresh path is skipped and we
    // exercise the reactive 401 -> refresh -> retry path.
    localStorage.setItem('rc_access_token', 'old-token');
    localStorage.setItem('rc_refresh_token', 'refresh-1');
    localStorage.setItem('rc_token_expires_at', String(Date.now() + 100_000));

    const refreshed: AuthResponse = {
      tokenType: 'Bearer',
      accessToken: 'new-token',
      expiresInSeconds: 3600,
      refreshToken: 'refresh-2',
      user: {
        id: 'u1',
        email: 'a@b.com',
        fullName: 'A B',
        provider: 'LOCAL',
        status: 'ACTIVE',
        roles: ['CUSTOMER'],
        emailVerifiedAt: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    };

    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // original -> 401
      .mockResolvedValueOnce(jsonResponse(refreshed)) // /auth/refresh -> ok
      .mockResolvedValueOnce(jsonResponse({ secret: 42 })); // retried original -> ok

    const data = await request<{ secret: number }>('GET', '/api/v1/me', { auth: true });

    expect(data).toEqual({ secret: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // second call hit the refresh endpoint
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/auth/refresh');

    // retried call carried the newly minted access token
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer new-token');

    // token store was updated by the refresh
    expect(TokenStore.getAccessToken()).toBe('new-token');
  });

  it('does not retry a 401 when there is no refresh token', async () => {
    localStorage.setItem('rc_access_token', 'old-token');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 401, code: 'UNAUTHORIZED', message: 'Nope' }, 401),
    );
    await expect(request('GET', '/api/v1/me', { auth: true })).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

// ── the store claim ───────────────────────────────────────────────────
/**
 * The slug goes up as a statement of which store this tab believes it is in. The server resolves
 * the tenant itself and rejects the claim when it disagrees, so these tests are about the claim
 * being sent where it matters, withheld where it would cost a preflight, and recovered from when
 * it turns out to be stale.
 */
describe('store claim', () => {
  function claimOn(callIndex = 0): string | undefined {
    const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
    return (init.headers as Record<string, string>)['X-Store-Slug'];
  }

  it('claims the stored store on an authenticated GET', async () => {
    StoreScope.set('acme');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await request('GET', '/api/v1/cart', { auth: true });
    expect(claimOn()).toBe('acme');
  });

  it('claims the stored store on every write, signed in or not', async () => {
    StoreScope.set('acme');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await request('POST', '/api/v1/reviews', { body: { rating: 5 } });
    expect(claimOn()).toBe('acme');
  });

  /** A custom header on a public GET buys a preflight per product URL and guards no write. */
  it('withholds the claim on an anonymous catalogue GET', async () => {
    StoreScope.set('acme');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await request('GET', '/api/v1/products/abc');
    expect(claimOn()).toBeUndefined();
  });

  it('withholds the claim when nothing has been learned yet', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await request('POST', '/api/v1/things', { body: {} });
    expect(claimOn()).toBeUndefined();
  });

  it('withholds the claim when the caller opts out', async () => {
    StoreScope.set('acme');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await request('GET', '/api/v1/store', { claimStore: false });
    expect(claimOn()).toBeUndefined();
  });

  /**
   * The recovery path. A domain re-pointed at another store leaves this tab claiming the old one;
   * the user must not see an error for it, so the claim is dropped and the call goes again without
   * it — the server then resolves the tenant from the origin as it would have anyway.
   */
  it('drops a stale claim, retries once without it, and reports the staleness', async () => {
    StoreScope.set('stale-store');
    const onStale = vi.fn();
    setStoreContextStaleHandler(onStale);

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          { status: 409, code: 'STORE_CONTEXT_STALE', message: 'Different store' },
          409,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(request('GET', '/api/v1/cart', { auth: true })).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(claimOn(1)).toBeUndefined();
    expect(StoreScope.get()).toBeNull();
    expect(onStale).toHaveBeenCalledOnce();
  });

  it('does not loop when the retry is refused again', async () => {
    StoreScope.set('stale-store');
    setStoreContextStaleHandler(() => {});
    const conflict = () =>
      jsonResponse({ status: 409, code: 'STORE_CONTEXT_STALE', message: 'Different store' }, 409);

    fetchMock.mockResolvedValueOnce(conflict()).mockResolvedValueOnce(conflict());

    await expect(request('GET', '/api/v1/cart', { auth: true })).rejects.toMatchObject({
      status: 409,
      code: 'STORE_CONTEXT_STALE',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /** Only this code is recoverable; any other 409 is the caller's problem to surface. */
  it('leaves an unrelated 409 alone', async () => {
    StoreScope.set('acme');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 409, code: 'DOMAIN_TAKEN', message: 'Taken' }, 409),
    );
    await expect(request('POST', '/api/v1/things', { body: {} })).rejects.toMatchObject({
      code: 'DOMAIN_TAKEN',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(StoreScope.get()).toBe('acme');
  });
});
