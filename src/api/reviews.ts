import { buildQuery, request } from '@/lib/http';
import type {
  CreateReviewRequest,
  MyReview,
  MyReviewResponse,
  Page,
  ReviewResponse,
  ReviewSummaryResponse,
  UpdateReviewRequest,
} from '@/lib/types';

// All review routes are scoped to a product by its UUID (NOT its slug).
const base = (productId: string) => `/api/v1/products/${encodeURIComponent(productId)}/reviews`;

// ── Public reads (APPROVED reviews only) ──────────────────────────────
export function listReviews(
  productId: string,
  params: { page?: number; size?: number; sort?: string } = {},
): Promise<Page<ReviewResponse>> {
  return request('GET', `${base(productId)}${buildQuery(params as Record<string, unknown>)}`);
}

export function getReviewSummary(productId: string): Promise<ReviewSummaryResponse> {
  return request('GET', `${base(productId)}/summary`);
}

// ── Customer (authenticated) ──────────────────────────────────────────
export function getMyReview(productId: string): Promise<MyReviewResponse> {
  return request('GET', `${base(productId)}/mine`, { auth: true });
}

/** Create my review (verified purchase required). 403 REVIEW_NOT_PURCHASED / 409 REVIEW_ALREADY_EXISTS. */
export function createReview(productId: string, body: CreateReviewRequest): Promise<MyReview> {
  return request('POST', base(productId), { body, auth: true });
}

/** Replace my review (rating/title/body). Resets it to PENDING for re-moderation. */
export function updateMyReview(productId: string, body: UpdateReviewRequest): Promise<MyReview> {
  return request('PUT', `${base(productId)}/mine`, { body, auth: true });
}
