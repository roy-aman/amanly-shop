import { request } from '@/lib/http';
import type { CartResponse } from '@/lib/types';

const P = '/api/v1/cart';

// Variant-aware cart ops (WP-3.5). `variantId` is optional and backward-compatible:
// omit it for a variantless product (existing callers keep working unchanged); pass it
// for a variant line so update/remove target the right line and add sends the variant.
function variantQuery(variantId?: string | null): string {
  return variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
}

export function getCart(): Promise<CartResponse> {
  return request('GET', P, { auth: true });
}
export function addToCart(productId: string, quantity: number, variantId?: string | null): Promise<CartResponse> {
  const body = variantId ? { productId, variantId, quantity } : { productId, quantity };
  return request('POST', `${P}/items`, { body, auth: true });
}
export function updateCartItem(
  productId: string,
  quantity: number,
  variantId?: string | null,
): Promise<CartResponse> {
  return request('PUT', `${P}/items/${productId}${variantQuery(variantId)}`, { body: { quantity }, auth: true });
}
export function removeCartItem(productId: string, variantId?: string | null): Promise<CartResponse> {
  return request('DELETE', `${P}/items/${productId}${variantQuery(variantId)}`, { auth: true });
}
export function clearCart(): Promise<void> {
  return request('DELETE', P, { auth: true });
}
