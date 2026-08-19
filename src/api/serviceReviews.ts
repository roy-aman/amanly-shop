import { buildQuery, request } from '@/lib/http';
import type {
  AdminServiceReviewResponse,
  CreateReviewRequest,
  MyReview,
  MyServiceReviewResponse,
  Page,
  ReviewResponse,
  ReviewStatus,
  ReviewSummaryResponse,
  UpdateReviewRequest,
} from '@/lib/types';

/**
 * Service reviews.
 *
 * Deliberately the same request and response shapes as product reviews, so one
 * set of review components can serve both. Only two things differ: these routes
 * are keyed by the service's UUID (never its slug), and eligibility comes from a
 * COMPLETED appointment rather than a delivered order — 403 REVIEW_NOT_BOOKED
 * where the product side says REVIEW_NOT_PURCHASED.
 */
const base = (serviceId: string) => `/api/v1/services/${encodeURIComponent(serviceId)}/reviews`;

// ── Public reads (APPROVED reviews only) ──────────────────────────────
export function listServiceReviews(
  serviceId: string,
  params: { page?: number; size?: number; sort?: string } = {},
): Promise<Page<ReviewResponse>> {
  return request('GET', `${base(serviceId)}${buildQuery(params as Record<string, unknown>)}`);
}

export function getServiceReviewSummary(serviceId: string): Promise<ReviewSummaryResponse> {
  return request('GET', `${base(serviceId)}/summary`);
}

// ── Customer (authenticated) ──────────────────────────────────────────
/** `booked` is this response's version of `purchased`: it is true once the
 *  customer has an appointment marked COMPLETED. */
export function getMyServiceReview(serviceId: string): Promise<MyServiceReviewResponse> {
  return request('GET', `${base(serviceId)}/mine`, { auth: true });
}

/** 403 REVIEW_NOT_BOOKED without a completed appointment;
 *  409 REVIEW_ALREADY_EXISTS on a second attempt — switch the form to editing. */
export function createServiceReview(serviceId: string, body: CreateReviewRequest): Promise<MyReview> {
  return request('POST', base(serviceId), { body, auth: true });
}

/** Replaces my review and sends it BACK to moderation, so it disappears from the
 *  public list until approved again. Worth saying before someone edits. */
export function updateMyServiceReview(serviceId: string, body: UpdateReviewRequest): Promise<MyReview> {
  return request('PUT', `${base(serviceId)}/mine`, { body, auth: true });
}

// ── Moderation (ADMIN, STAFF) ─────────────────────────────────────────
export const adminServiceReviews = {
  list(
    params: { status?: ReviewStatus; page?: number; size?: number } = {},
  ): Promise<Page<AdminServiceReviewResponse>> {
    return request('GET', `/api/v1/admin/service-reviews${buildQuery(params as Record<string, unknown>)}`, {
      auth: true,
    });
  },
  approve(reviewId: string): Promise<AdminServiceReviewResponse> {
    return request('POST', `/api/v1/admin/service-reviews/${reviewId}/approve`, { auth: true });
  },
  reject(reviewId: string): Promise<AdminServiceReviewResponse> {
    return request('POST', `/api/v1/admin/service-reviews/${reviewId}/reject`, { auth: true });
  },
};
