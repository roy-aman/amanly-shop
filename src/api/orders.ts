import { buildQuery, request } from '@/lib/http';
import type {
  Page,
  OrderResponse,
  OrderSummaryResponse,
  PlaceOrderRequest,
  RazorpayVerifyRequest,
  UpiApp,
} from '@/lib/types';

const P = '/api/v1/orders';

export function placeOrder(body: PlaceOrderRequest): Promise<OrderResponse> {
  return request('POST', P, { body, auth: true });
}
export function listOrders(params: { page?: number; size?: number; sort?: string } = {}): Promise<Page<OrderSummaryResponse>> {
  return request('GET', `${P}${buildQuery(params)}`, { auth: true });
}
export function getOrder(orderId: string): Promise<OrderResponse> {
  return request('GET', `${P}/${orderId}`, { auth: true });
}
export function cancelOrder(orderId: string): Promise<OrderResponse> {
  return request('POST', `${P}/${orderId}/cancel`, { auth: true });
}
/**
 * Attaches a Manual UPI token to a COD order so the customer can pay it early via UPI instead
 * of waiting for delivery. Idempotent — a second call just returns the existing token.
 *
 * `upiApp` is required only where the store runs token-based verification; leave it out otherwise,
 * since any UPI app can pay the store's handle.
 */
export function enableManualUpiForOrder(orderId: string, upiApp?: UpiApp | null): Promise<OrderResponse> {
  return request('POST', `${P}/${orderId}/manual-upi`, { body: upiApp ? { upiApp } : undefined, auth: true });
}
export function verifyRazorpayPayment(body: RazorpayVerifyRequest): Promise<OrderResponse> {
  return request('POST', '/api/v1/payments/razorpay/verify', { body, auth: true });
}
