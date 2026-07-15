import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import OrderDetail from './OrderDetail';
import { getOrder } from '@/api/orders';
import type { OrderResponse } from '@/lib/types';

vi.mock('@/api/orders', () => ({ getOrder: vi.fn(), cancelOrder: vi.fn() }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const getOrderMock = vi.mocked(getOrder);

function order(overrides: Partial<OrderResponse> = {}): OrderResponse {
  return {
    id: 'order-123',
    userId: 'u1',
    status: 'PENDING',
    paymentMethod: 'CASH',
    paymentStatus: 'PENDING',
    totalAmount: 85,
    discountAmount: 15,
    couponCode: 'SAVE15',
    currency: 'USD',
    shippingAddress: {
      name: 'Jane Doe', phone: null, addressLine1: '1 King St', addressLine2: null,
      city: 'Metropolis', state: null, postalCode: '90001', country: 'US',
    },
    notes: null,
    items: [
      { id: 'i1', productId: 'p1', productName: 'Signet Ring', sku: 'R1', unitPrice: 100, quantity: 1, subtotal: 100 },
    ],
    paymentAction: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrderDetail discount line (WP-3.4)', () => {
  it('shows the coupon code and discount when the order has a discount', async () => {
    getOrderMock.mockResolvedValue(order());
    renderWithProviders(<OrderDetail />);

    expect(await screen.findByText(/Discount \(SAVE15\)/i)).toBeInTheDocument();
    expect(screen.getByText('−$15.00')).toBeInTheDocument();
    // The discounted total (subtotal 100 − 15) is the payable amount.
    expect(screen.getByText('$85.00')).toBeInTheDocument();
  });

  it('shows a plain total when there is no discount', async () => {
    getOrderMock.mockResolvedValue(order({ totalAmount: 100, discountAmount: 0, couponCode: null }));
    renderWithProviders(<OrderDetail />);

    await screen.findByText('Signet Ring');
    expect(screen.queryByText(/Discount/i)).not.toBeInTheDocument();
  });
});
