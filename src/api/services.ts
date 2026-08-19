import { buildQuery, request } from '@/lib/http';
import type {
  AdminServiceOfferingResponse,
  AvailabilityResponse,
  CreateServiceCategoryRequest,
  CreateServiceOfferingRequest,
  Page,
  PublicBusinessHoursResponse,
  ServiceCategoryResponse,
  ServiceOfferingResponse,
  UpdateServiceCategoryRequest,
  UpdateServiceOfferingRequest,
} from '@/lib/types';

const A = '/api/v1/admin';

/**
 * The service menu (public).
 *
 * Sorted by the merchant's own order then name, server-side — do not pass a
 * `sort`. Only active services come back; a store with bookings switched off
 * answers 404 BOOKINGS_NOT_AVAILABLE for every route in this file, which the
 * calling screen treats as "this shop has no services surface" rather than as a
 * failure.
 */
export function listServices(
  params: { categoryId?: string; q?: string; page?: number; size?: number } = {},
): Promise<Page<ServiceOfferingResponse>> {
  return request('GET', `/api/v1/services${buildQuery(params as Record<string, unknown>)}`);
}

/**
 * One service, BY SLUG.
 *
 * Note the asymmetry that catches everyone: detail is by slug, but availability
 * and reviews are by the UUID this call returns. A booking screen therefore has
 * to resolve the service before it can ask what times are free — which is why
 * the wizard carries the service object rather than the slug alone.
 */
export function getService(slug: string): Promise<ServiceOfferingResponse> {
  return request('GET', `/api/v1/services/${encodeURIComponent(slug)}`);
}

/**
 * What is free on one day — the ONLY source of bookable times.
 *
 * The server applies opening hours, slot granularity, lead time, the advance
 * window, clean-up buffers, capacity and (when `staffId` is given) that person's
 * own diary. Deriving times in the browser instead means offering slots the shop
 * cannot serve, so nothing here is ever recomputed client-side.
 *
 * `date` is YYYY-MM-DD in the STORE's zone — not `new Date().toISOString()`,
 * which flips the day near midnight for a customer in another zone. Leaving
 * `staffId` off asks "can anyone take this", which yields more times and is the
 * right default.
 *
 * An empty `slots` array is a normal answer, not an error.
 */
export function getAvailability(
  serviceId: string,
  date: string,
  staffId?: string | null,
): Promise<AvailabilityResponse> {
  return request(
    'GET',
    `/api/v1/services/${encodeURIComponent(serviceId)}/availability${buildQuery({ date, staffId })}`,
  );
}

/** Flat menu sections in the merchant's order (public, active only). */
export function listServiceCategories(): Promise<ServiceCategoryResponse[]> {
  return request('GET', '/api/v1/service-categories');
}

/**
 * When the shop is open (public).
 *
 * A weekday absent from `businessHours` is closed — there is no flag saying so.
 * Times are wall clock in `timezone`, never instants.
 */
export function getBusinessHours(): Promise<PublicBusinessHoursResponse> {
  return request('GET', '/api/v1/business-hours');
}

/**
 * The service menu, from the console (ADMIN, STAFF).
 *
 * Reachable as soon as the platform has granted the entitlement — before the
 * merchant flips their own switch — so a shop can build its menu, hours and team
 * in private and go live in one move. Without the entitlement every call is 403
 * BOOKINGS_NOT_ALLOWED, which the screens render as "not part of your plan".
 */
export const adminServices = {
  list(
    params: { categoryId?: string; q?: string; page?: number; size?: number } = {},
  ): Promise<Page<AdminServiceOfferingResponse>> {
    return request('GET', `${A}/services${buildQuery(params as Record<string, unknown>)}`, { auth: true });
  },
  get(serviceId: string): Promise<AdminServiceOfferingResponse> {
    return request('GET', `${A}/services/${serviceId}`, { auth: true });
  },
  create(body: CreateServiceOfferingRequest): Promise<AdminServiceOfferingResponse> {
    return request('POST', `${A}/services`, { body, auth: true });
  },
  /** Full replace — `bufferMinutes`, `active` and `sortOrder` must be sent. */
  update(serviceId: string, body: UpdateServiceOfferingRequest): Promise<AdminServiceOfferingResponse> {
    return request('PUT', `${A}/services/${serviceId}`, { body, auth: true });
  },
  /** ADMIN only, and 409 SERVICE_HAS_BOOKINGS while any booking references it —
   *  the history is the point, so the answer is to deactivate instead. */
  remove(serviceId: string): Promise<void> {
    return request('DELETE', `${A}/services/${serviceId}`, { auth: true });
  },
};

/** Service categories, from the console (ADMIN, STAFF). Includes inactive ones. */
export const adminServiceCategories = {
  list(): Promise<ServiceCategoryResponse[]> {
    return request('GET', `${A}/service-categories`, { auth: true });
  },
  create(body: CreateServiceCategoryRequest): Promise<ServiceCategoryResponse> {
    return request('POST', `${A}/service-categories`, { body, auth: true });
  },
  /** Full replace — `sortOrder` and `active` are required. */
  update(categoryId: string, body: UpdateServiceCategoryRequest): Promise<ServiceCategoryResponse> {
    return request('PUT', `${A}/service-categories/${categoryId}`, { body, auth: true });
  },
  /** ADMIN only; 409 SERVICE_CATEGORY_IN_USE while services still sit in it. */
  remove(categoryId: string): Promise<void> {
    return request('DELETE', `${A}/service-categories/${categoryId}`, { auth: true });
  },
};
