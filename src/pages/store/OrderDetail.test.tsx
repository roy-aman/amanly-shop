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

/**
 * The page reads as a receipt: labelled blocks, one fact per line. These pin the blocks and the
 * shape of a purchased line, because the old four-column table said the same things and a
 * regression back to it would pass every assertion above.
 */
describe('OrderDetail receipt layout', () => {
  it('lays the order out as labelled blocks', async () => {
    getOrderMock.mockResolvedValue(order());
    renderWithProviders(<OrderDetail />);

    for (const block of [/items ordered/i, /order info/i, /delivery address/i, /bill summary/i]) {
      expect(await screen.findByRole('heading', { name: block })).toBeInTheDocument();
    }
  });

  it('states a line as name, then quantity × unit price, then what it came to', async () => {
    getOrderMock.mockResolvedValue(
      order({
        items: [
          { id: 'i1', productId: 'p1', productName: 'Signet Ring', sku: 'R1', unitPrice: 50, quantity: 2, subtotal: 100 },
        ],
      }),
    );
    renderWithProviders(<OrderDetail />);

    expect(await screen.findByText('Signet Ring')).toBeInTheDocument();
    // The breakdown reads as a sentence on the line rather than as two more columns.
    expect(screen.getByText('2 × $50.00')).toBeInTheDocument();
    // $100 twice: what the line came to, and the item total it agrees with in the bill.
    expect(screen.getAllByText('$100.00')).toHaveLength(2);
    // A column header row is exactly the thing this layout replaced.
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
  });

  it('names the variant on the line when there is one, and the SKU when there is not', async () => {
    getOrderMock.mockResolvedValue(
      order({
        items: [
          { id: 'i1', productId: 'p1', productName: 'Signet Ring', sku: 'R1', unitPrice: 100, quantity: 1, subtotal: 100, variantOptions: 'size: M' },
          { id: 'i2', productId: 'p2', productName: 'Leather Belt', sku: 'B1', unitPrice: 60, quantity: 1, subtotal: 60 },
        ],
      }),
    );
    renderWithProviders(<OrderDetail />);

    expect(await screen.findByText('size: M')).toBeInTheDocument();
    expect(screen.getByText('SKU: B1')).toBeInTheDocument();
  });

  /**
   * The picture is read live from the product, not snapshotted onto the line — no money depends on
   * a thumbnail, and a snapshotted URL would only guarantee that old orders eventually point at
   * deleted images. A product removed since placement sends none, and the monogram takes over.
   */
  it('shows the product photograph on the line, and its initials when there is none', async () => {
    getOrderMock.mockResolvedValue(
      order({
        items: [
          { id: 'i1', productId: 'p1', productName: 'Signet Ring', sku: 'R1', unitPrice: 100, quantity: 1, subtotal: 100, productImageUrl: 'https://cdn.test/ring.jpg' },
          { id: 'i2', productId: 'p2', productName: 'Leather Belt', sku: 'B1', unitPrice: 60, quantity: 1, subtotal: 60 },
        ],
      }),
    );
    renderWithProviders(<OrderDetail />);

    await screen.findByText('Signet Ring');
    // Empty alt: the product name is the next thing in the row as real text, so a described image
    // would say it twice.
    const thumbs = document.querySelectorAll('img[alt=""]');
    expect(thumbs).toHaveLength(1);
    expect(thumbs[0]).toHaveAttribute('src', 'https://cdn.test/ring.jpg');
    // The line with no photo falls back to initials rather than a hole.
    expect(screen.getByText('LB')).toBeInTheDocument();
  });

  it('carries the order reference in the header and in the facts block', async () => {
    getOrderMock.mockResolvedValue(order({ orderNumber: 'ORD-Y2PJYKCT' }));
    renderWithProviders(<OrderDetail />);

    expect(await screen.findAllByText('ORD-Y2PJYKCT')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /back to orders/i })).toHaveAttribute('href', '/orders');
  });
});
