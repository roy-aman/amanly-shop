import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { adminBookings, cancelBooking, listMyBookings, placeBooking, rescheduleBooking } from './bookings';
import { getAvailability, listServices } from './services';
import { TokenStore } from '@/lib/http';

/**
 * What these pin is the wire, not the screens: the exact URL and body each call
 * produces.
 *
 * The one that matters most is `startsAt`. The server offers a slot as a string
 * and refuses any time it did not offer, so a client that round-trips it through
 * a Date — same instant, different spelling — turns a valid booking into a 400
 * that looks like a backend bug. It is asserted here byte for byte because it is
 * invisible everywhere else.
 */
function okJson(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('booking API wire format', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(() => okJson({}));
    localStorage.clear();
    TokenStore.save({
      tokenType: 'Bearer',
      accessToken: 'access-1',
      expiresInSeconds: 900,
      refreshToken: 'refresh-1',
      user: {
        id: 'u1',
        email: 'c@example.com',
        fullName: 'Customer',
        provider: 'LOCAL',
        status: 'ACTIVE',
        roles: ['CUSTOMER'],
        emailVerifiedAt: null,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    localStorage.clear();
  });

  function lastCall() {
    const calls = fetchMock.mock.calls;
    const [url, init] = calls[calls.length - 1] as [string, RequestInit];
    return { url, init, body: init.body ? JSON.parse(String(init.body)) : undefined };
  }

  it('sends the offered start time back exactly as received', async () => {
    // Not a normalised form, not a re-serialised Date — this string.
    const offered = '2026-08-21T09:00:00Z';
    await placeBooking({ serviceOfferingId: 'svc-1', startsAt: offered });

    const { url, init, body } = lastCall();
    expect(url).toContain('/api/v1/bookings');
    expect(init.method).toBe('POST');
    expect(body.startsAt).toBe(offered);
    expect(new Date(body.startsAt).toISOString()).not.toBe(body.startsAt); // proves it was NOT normalised
  });

  it('omits the staff id when the customer has no preference', async () => {
    // "Anyone available" has to reach the server as an absent staff id: sending
    // one narrows availability to that person's diary.
    await placeBooking({ serviceOfferingId: 'svc-1', startsAt: '2026-08-21T09:00:00Z' });
    expect(lastCall().body.staffProfileId).toBeUndefined();
  });

  it('asks for availability by service UUID, with the store-local date', async () => {
    await getAvailability('svc-uuid', '2026-08-21');
    expect(lastCall().url).toContain('/api/v1/services/svc-uuid/availability?date=2026-08-21');
  });

  it('drops the staff filter from the availability query when unset', async () => {
    // buildQuery skips undefined, so "anyone" must not become `staffId=undefined`.
    await getAvailability('svc-uuid', '2026-08-21', null);
    expect(lastCall().url).not.toContain('staffId');
  });

  it('cancels with and without a reason', async () => {
    await cancelBooking('bk-1');
    expect(lastCall().body).toEqual({});

    await cancelBooking('bk-1', 'Something came up');
    expect(lastCall().body).toEqual({ reason: 'Something came up' });
  });

  it('reschedules in place, sending only the new start', async () => {
    await rescheduleBooking('bk-1', '2026-08-22T11:30:00Z');
    const { url, body } = lastCall();
    expect(url).toContain('/api/v1/bookings/bk-1/reschedule');
    expect(body).toEqual({ newStartsAt: '2026-08-22T11:30:00Z' });
  });

  it('carries the bearer token on customer booking reads', async () => {
    await listMyBookings({ page: 1 });
    const { url, init } = lastCall();
    expect(url).toContain('/api/v1/bookings?page=1');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
  });

  it('composes the console diary filters into one query', async () => {
    await adminBookings.list({
      from: '2026-08-21T00:00:00.000Z',
      to: '2026-08-22T00:00:00.000Z',
      staffId: 'staff-1',
      status: 'CONFIRMED',
      q: 'BKG-1',
    });
    const { url } = lastCall();
    expect(url).toContain('from=2026-08-21T00%3A00%3A00.000Z');
    expect(url).toContain('to=2026-08-22T00%3A00%3A00.000Z');
    expect(url).toContain('staffId=staff-1');
    expect(url).toContain('status=CONFIRMED');
    expect(url).toContain('q=BKG-1');
  });

  it('sends an explicit null to unassign a staff member', async () => {
    // A missing key would read as "no change"; the null is the instruction.
    await adminBookings.assignStaff('bk-1', null);
    expect(lastCall().body).toEqual({ staffProfileId: null });
  });

  it('leaves the public service list unauthenticated', async () => {
    await listServices({ q: 'trim' });
    const { url, init } = lastCall();
    expect(url).toContain('/api/v1/services?q=trim');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
