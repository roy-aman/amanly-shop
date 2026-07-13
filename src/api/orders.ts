import { buildQuery, request } from '@/lib/http';
import type {
  Page,
  OrderResponse,
  OrderSummaryResponse,
  PlaceOrderRequest,
  RazorpayVerifyRequest,
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
export function verifyRazorpayPayment(body: RazorpayVerifyRequest): Promise<OrderResponse> {
  return request('POST', '/api/v1/payments/razorpay/verify', { body, auth: true });
}
