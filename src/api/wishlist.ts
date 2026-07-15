import { request } from '@/lib/http';
import type { ProductSummaryResponse, WishlistMutationResponse } from '@/lib/types';

// The signed-in user's wishlist. Every route requires auth (401 if logged out).
const P = '/api/v1/users/me/wishlist';

/** My wishlist as product summaries, most-recent first. */
export function getWishlist(): Promise<ProductSummaryResponse[]> {
  return request('GET', P, { auth: true });
}

/** My wishlisted product ids — lightweight, primes heart state across many cards in one call. */
export function getWishlistIds(): Promise<string[]> {
  return request('GET', `${P}/ids`, { auth: true });
}

/** Add a product to my wishlist (idempotent). 404 if the product does not exist. */
export function addToWishlist(productId: string): Promise<WishlistMutationResponse> {
  return request('POST', `${P}/${encodeURIComponent(productId)}`, { auth: true });
}

/** Remove a product from my wishlist (idempotent). */
export function removeFromWishlist(productId: string): Promise<WishlistMutationResponse> {
  return request('DELETE', `${P}/${encodeURIComponent(productId)}`, { auth: true });
}
