import { TokenStore, apiUrl, buildQuery, request } from '@/lib/http';
import type {
  AdminBookingResponse,
  BookingResponse,
  BookingSettingsResponse,
  BookingStatus,
  BookingStatusChangeRequest,
  CreateWalkInBookingRequest,
  Page,
  PlaceBookingRequest,
  UpdateBookingSettingsRequest,
} from '@/lib/types';

const C = '/api/v1/bookings';
const A = '/api/v1/admin/bookings';

/**
 * Hands a booking's calendar entry to the browser as a download.
 *
 * Hand-rolled rather than going through `request` for the same reason the CSV
 * export is: the response is `text/calendar`, and a plain `<a href>` cannot
 * carry the bearer token — it would 401 and the customer would get nothing.
 *
 * The event's UID is stable across reschedules and its SEQUENCE follows the
 * booking's version, so re-downloading after a change UPDATES the entry someone
 * already added rather than leaving them with two. A cancelled booking downloads
 * as CANCELLED, which retracts it.
 *
 * Prefer `booking.googleCalendarUrl` where a link will do: it needs no
 * authentication and no download at all.
 */
async function downloadCalendar(path: string, bookingNumber: string) {
  const token = TokenStore.getAccessToken();
  const res = await fetch(apiUrl(path), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('The calendar file could not be produced.');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${bookingNumber}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Released on the next tick: revoking synchronously can cancel the download
  // in some browsers before they have read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Places a booking. 201, and it is CONFIRMED immediately — nothing is charged
 * and no payment step exists; the customer pays at the venue.
 *
 * `startsAt` must be a slot the availability call offered, passed through
 * untouched. Two failures are normal rather than exceptional and both are the
 * caller's to handle:
 *
 *  - **409 SLOT_NO_LONGER_AVAILABLE** — someone else took it between render and
 *    submit. Refresh the picker and let the customer choose again. Never retry
 *    automatically: that books a time they did not pick.
 *  - **400 BOOKING_OUTSIDE_RULES** — the time is not on the grid, is inside the
 *    lead time, beyond the advance window, or outside opening hours. Refetch
 *    availability rather than adjusting the time by hand.
 */
export function placeBooking(body: PlaceBookingRequest): Promise<BookingResponse> {
  return request('POST', C, { body, auth: true });
}

/** My bookings, newest first (server-sorted). */
export function listMyBookings(params: { page?: number; size?: number } = {}): Promise<Page<BookingResponse>> {
  return request('GET', `${C}${buildQuery(params as Record<string, unknown>)}`, { auth: true });
}

/** One of mine. Somebody else's id is a plain 404 — never 403, so an id cannot
 *  be used to discover whose it is. */
export function getMyBooking(bookingId: string): Promise<BookingResponse> {
  return request('GET', `${C}/${bookingId}`, { auth: true });
}

/**
 * Cancels my booking. The reason is optional and so is the body itself.
 *
 * 409 BOOKING_CUTOFF_PASSED once the shop's cancellation cut-off has gone by.
 * The cut-off is not published anywhere the storefront can read, so the buttons
 * stay on offer and this answer is the boundary — show it as "please contact the
 * store", never as a failure.
 */
export function cancelBooking(bookingId: string, reason?: string | null): Promise<BookingResponse> {
  return request('POST', `${C}/${bookingId}/cancel`, { body: reason ? { reason } : {}, auth: true });
}

/** Moves my booking in place: the id, booking number and calendar UID all
 *  survive. Same 409s as placing one, plus the cut-off. */
export function rescheduleBooking(bookingId: string, newStartsAt: string): Promise<BookingResponse> {
  return request('POST', `${C}/${bookingId}/reschedule`, { body: { newStartsAt }, auth: true });
}

export function downloadBookingIcs(bookingId: string, bookingNumber: string): Promise<void> {
  return downloadCalendar(`${C}/${bookingId}/calendar.ics`, bookingNumber);
}

/**
 * The diary, from the console (ADMIN, STAFF).
 *
 * Every staff member sees every booking — there is no per-person filter on the
 * server, which is what makes a shared front-desk screen possible.
 */
export const adminBookings = {
  /**
   * `from` and `to` are ISO instants, `to` exclusive. Building a day span means
   * converting the shop's local midnight — not the browser's — into UTC, or
   * early and late appointments land on the wrong day.
   *
   * `q` matches a booking number (typo-forgiving), a customer name or a phone
   * number, which is what someone at a counter actually has to hand.
   */
  list(
    params: {
      from?: string;
      to?: string;
      staffId?: string;
      status?: BookingStatus;
      q?: string;
      page?: number;
      size?: number;
    } = {},
  ): Promise<Page<AdminBookingResponse>> {
    return request('GET', `${A}${buildQuery(params as Record<string, unknown>)}`, { auth: true });
  },
  get(bookingId: string): Promise<AdminBookingResponse> {
    return request('GET', `${A}/${bookingId}`, { auth: true });
  },
  /** Takes a booking for someone standing at the counter or on the phone. The
   *  lead-time and advance-window rules are waived; the clash check is not. */
  createWalkIn(body: CreateWalkInBookingRequest): Promise<AdminBookingResponse> {
    return request('POST', A, { body, auth: true });
  },
  /** `null` unassigns. 409 when that person is already busy then. */
  assignStaff(bookingId: string, staffProfileId: string | null): Promise<AdminBookingResponse> {
    return request('POST', `${A}/${bookingId}/assign-staff`, { body: { staffProfileId }, auth: true });
  },
  /**
   * COMPLETED, NO_SHOW or CANCELLED. Never back to CONFIRMED (400), and neither
   * COMPLETED nor NO_SHOW is accepted before the appointment has started (400
   * BOOKING_NOT_STARTED) — so those controls should be visibly unavailable until
   * then rather than failing on click.
   */
  setStatus(bookingId: string, body: BookingStatusChangeRequest): Promise<AdminBookingResponse> {
    return request('PATCH', `${A}/${bookingId}/status`, { body, auth: true });
  },
  /** Staff reschedule: no cut-off applies. */
  reschedule(bookingId: string, newStartsAt: string): Promise<AdminBookingResponse> {
    return request('POST', `${A}/${bookingId}/reschedule`, { body: { newStartsAt }, auth: true });
  },
  downloadIcs(bookingId: string, bookingNumber: string): Promise<void> {
    return downloadCalendar(`${A}/${bookingId}/calendar.ics`, bookingNumber);
  },
};

/**
 * The rules behind the diary (ADMIN only — not STAFF).
 *
 * `update` is a FULL replace, weekly hours included: whatever is sent becomes
 * the shop's entire schedule. A form must load current settings before it can
 * submit, or a save writes an empty week and closes the shop.
 */
export const adminBookingSettings = {
  get(): Promise<BookingSettingsResponse> {
    return request('GET', '/api/v1/admin/booking-settings', { auth: true });
  },
  update(body: UpdateBookingSettingsRequest): Promise<BookingSettingsResponse> {
    return request('PUT', '/api/v1/admin/booking-settings', { body, auth: true });
  },
};
