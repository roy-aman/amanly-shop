import { request } from '@/lib/http';
import type { CouponPreviewResponse } from '@/lib/types';

/**
 * Preview a coupon against the caller's server cart (auth required). ALWAYS resolves
 * with HTTP 200 — a rejected coupon is a normal outcome, so read `valid` on the body
 * rather than catching an error. `subtotal` is an advisory fallback the server ignores
 * when the caller has a non-empty cart. The real discount is recomputed at placement.
 */
export function validateCoupon(code: string, subtotal?: number | null): Promise<CouponPreviewResponse> {
  return request('POST', '/api/v1/coupons/validate', {
    body: { code, subtotal: subtotal ?? null },
    auth: true,
  });
}
