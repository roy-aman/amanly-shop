import { request } from '@/lib/http';
import type { CartResponse } from '@/lib/types';

const P = '/api/v1/cart';

export function getCart(): Promise<CartResponse> {
  return request('GET', P, { auth: true });
}
export function addToCart(productId: string, quantity: number): Promise<CartResponse> {
  return request('POST', `${P}/items`, { body: { productId, quantity }, auth: true });
}
export function updateCartItem(productId: string, quantity: number): Promise<CartResponse> {
  return request('PUT', `${P}/items/${productId}`, { body: { quantity }, auth: true });
}
export function removeCartItem(productId: string): Promise<CartResponse> {
  return request('DELETE', `${P}/items/${productId}`, { auth: true });
}
export function clearCart(): Promise<void> {
  return request('DELETE', P, { auth: true });
}
