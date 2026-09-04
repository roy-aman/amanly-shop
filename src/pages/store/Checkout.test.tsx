import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Checkout from './Checkout';
import { createTestQueryClient } from '@/test/utils';
import { getPublicStore } from '@/api/store';
import { getCart, addToCart } from '@/api/cart';
import { placeOrder, cancelOrder } from '@/api/orders';
import { validateCoupon } from '@/api/coupons';
import { listAddresses } from '@/api/addresses';
import type {
  AddressResponse,
  CartResponse,
  CouponPreviewResponse,
  OrderResponse,
  PublicStoreResponse,
} from '@/lib/types';

vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));
vi.mock('@/api/cart', () => ({ getCart: vi.fn(), addToCart: vi.fn() }));
vi.mock('@/api/orders', () => ({ placeOrder: vi.fn(), verifyRazorpayPayment: vi.fn(), cancelOrder: vi.fn() }));
vi.mock('@/api/coupons', () => ({ validateCoupon: vi.fn() }));
vi.mock('@/api/addresses', () => ({ listAddresses: vi.fn(), addAddress: vi.fn() }));
vi.mock('@/lib/razorpay', () => ({ loadRazorpay: vi.fn() }));

const refresh = vi.fn();
vi.mock('@/context/CartContext', () => ({
  useCart: () => ({ cart: null, itemCount: 0, loading: false, refresh, setCart: vi.fn() }),
}));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

const storeMock = vi.mocked(getPublicStore);
const cartMock = vi.mocked(getCart);
const placeMock = vi.mocked(placeOrder);
const cancelMock = vi.mocked(cancelOrder);
const addToCartMock = vi.mocked(addToCart);
const addressesMock = vi.mocked(listAddresses);
const validateCouponMock = vi.mocked(validateCoupon);

function couponPreview(overrides: Partial<CouponPreviewResponse> = {}): CouponPreviewResponse {
  return {
    valid: true,
    code: 'SAVE10',
    reason: null,
    message: 'Coupon applied.',
    subtotal: 200,
    discountAmount: 20,
    total: 180,
    ...overrides,
  };
}

function codOrder(overrides: Partial<OrderResponse> = {}): OrderResponse {
  return {
    id: 'o1',
    userId: 'u1',
    status: 'PENDING',
    paymentMethod: 'CASH',
    paymentStatus: 'PENDING',
    totalAmount: 180,
    discountAmount: 20,
    couponCode: 'SAVE10',
    currency: 'USD',
    shippingAddress: {
      name: 'Jane Doe', phone: '555-1', addressLine1: '1 King St', addressLine2: 'Apt 2',
      city: 'Metropolis', state: 'CA', postalCode: '90001', country: 'US',
    },
    notes: null,
    items: [],
    paymentAction: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function store(overrides: Partial<PublicStoreResponse> = {}): PublicStoreResponse {
  return { slug: 'royal', name: 'Royal', currency: 'USD', codEnabled: true, onlinePaymentEnabled: true, ...overrides };
}

function cart(): CartResponse {
  return {
    cartId: 'c1',
    userId: 'u1',
    items: [
      { cartItemId: 'ci1', productId: 'p1', productName: 'Signet Ring', productSlug: 'signet-ring', sku: 'R1', quantity: 2, unitPrice: 100, subtotal: 200, reservationRemainingMinutes: null },
    ],
    totalAmount: 200,
    currency: 'USD',
  };
}

function address(): AddressResponse {
  return {
    id: 'a1',
    label: 'Home',
    recipientName: 'Jane Doe',
    phone: '555-1',
    addressLine1: '1 King St',
    addressLine2: 'Apt 2',
    city: 'Metropolis',
    state: 'CA',
    postalCode: '90001',
    country: 'US',
    isDefault: true,
    createdAt: '',
    updatedAt: '',
  };
}

function renderCheckout() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Checkout />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  storeMock.mockResolvedValue(store());
  cartMock.mockResolvedValue(cart());
  addressesMock.mockResolvedValue([address()]);
  validateCouponMock.mockResolvedValue(couponPreview());
});

describe('Checkout (WP-2.5)', () => {
  it('cannot advance past the Address step without a valid address', async () => {
    addressesMock.mockResolvedValue([]); // no saved addresses → inline form, nothing selected
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByText('Delivery address');
    await user.click(screen.getByRole('button', { name: 'Continue to review' }));

    // Stays on the Address step — Review heading never appears.
    expect(screen.queryByText('Review & place order')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/address/i);
  });

  it('payment methods reflect the store flags — COD only', async () => {
    storeMock.mockResolvedValue(store({ codEnabled: true, onlinePaymentEnabled: false }));
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByText('Delivery address');
    await user.click(await screen.findByRole('radio', { name: /Home/i }));
    await user.click(screen.getByRole('button', { name: 'Continue to review' }));

    await screen.findByText('Payment method');
    expect(screen.getByText('Cash on Delivery')).toBeInTheDocument();
    expect(screen.queryByText('UPI / Online payment')).not.toBeInTheDocument();
    expect(screen.getByText(/is the only payment method available/i)).toBeInTheDocument();
    // COD is the only option, so it's selected by default.
    expect(screen.getByRole('radio', { name: /Cash on Delivery/i })).toBeChecked();
  });

  it('payment methods reflect the store flags — online only, and defaults to it', async () => {
    storeMock.mockResolvedValue(store({ codEnabled: false, onlinePaymentEnabled: true }));
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByText('Delivery address');
    await user.click(await screen.findByRole('radio', { name: /Home/i }));
    await user.click(screen.getByRole('button', { name: 'Continue to review' }));

    await screen.findByText('Payment method');
    expect(screen.getByText('UPI / Online payment')).toBeInTheDocument();
    expect(screen.queryByText('Cash on Delivery')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /UPI \/ Online payment/i })).toBeChecked();
  });

  it('defaults to the online gateway over Manual UPI over COD when all three are enabled', async () => {
    storeMock.mockResolvedValue(store({ codEnabled: true, onlinePaymentEnabled: true, manualUpiEnabled: true }));
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByText('Delivery address');
    await user.click(await screen.findByRole('radio', { name: /Home/i }));
    await user.click(screen.getByRole('button', { name: 'Continue to review' }));

    await screen.findByText('Payment method');
    expect(screen.getByRole('radio', { name: /UPI \/ Online payment/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /UPI \(scan to pay\)/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Cash on Delivery/i })).not.toBeChecked();
  });

  it('COD happy path: Place order calls placeOrder with the mapped shippingAddress and navigates', async () => {
    const order: OrderResponse = codOrder({ totalAmount: 200, discountAmount: 0, couponCode: null });
    placeMock.mockResolvedValue(order);
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByText('Delivery address');
    await user.click(await screen.findByRole('radio', { name: /Home/i }));
    await user.click(screen.getByRole('button', { name: 'Continue to review' }));

    // Both COD and online are enabled by the default store fixture, so online is
    // preselected — pick Cash on Delivery explicitly to exercise the COD path.
    await screen.findByText('Review & place order');
    await user.click(screen.getByRole('radio', { name: /Cash on Delivery/i }));
    await user.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() =>
      expect(placeMock).toHaveBeenCalledWith({
        shippingAddress: {
          name: 'Jane Doe',
          phone: '555-1',
          addressLine1: '1 King St',
          addressLine2: 'Apt 2',
          city: 'Metropolis',
          state: 'CA',
          postalCode: '90001',
          country: 'US',
        },
        notes: null,
        paymentMethod: 'CASH',
        deliveryMethod: 'DELIVERY',
      }),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/orders/o1'));
    expect(refresh).toHaveBeenCalled();
  });

  it('carries a persisted valid coupon into placeOrder and shows the discount (WP-3.4)', async () => {
    localStorage.setItem('rc-applied-coupon', 'SAVE10'); // applied on the Cart page
    placeMock.mockResolvedValue(codOrder());
    const user = userEvent.setup();
    renderCheckout();

    // Re-validated on entry → discount surfaces in the order summary.
    expect(await screen.findByText(/Discount \(SAVE10\)/i)).toBeInTheDocument();
    await waitFor(() => expect(validateCouponMock).toHaveBeenCalledWith('SAVE10', 200));

    await user.click(await screen.findByRole('radio', { name: /Home/i }));
    await user.click(screen.getByRole('button', { name: 'Continue to review' }));
    await screen.findByText('Review & place order');
    await user.click(screen.getByRole('radio', { name: /Cash on Delivery/i }));
    await user.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() =>
      expect(placeMock).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethod: 'CASH', couponCode: 'SAVE10' }),
      ),
    );
    // Applied coupon is cleared after a successful placement.
    expect(localStorage.getItem('rc-applied-coupon')).toBeNull();
  });

  it('drops a persisted coupon the server now rejects, with a notice (WP-3.4)', async () => {
    localStorage.setItem('rc-applied-coupon', 'EXPIRED');
    validateCouponMock.mockResolvedValue(
      couponPreview({ valid: false, code: 'EXPIRED', reason: 'EXPIRED', message: 'This coupon has expired.', discountAmount: null, total: null }),
    );
    renderCheckout();

    expect(await screen.findByText(/coupon was removed/i)).toBeInTheDocument();
    expect(screen.queryByText(/Discount \(/i)).not.toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('rc-applied-coupon')).toBeNull());
  });

  it('closing Manual UPI QR pop-up via cross button cancels order, restores cart and leaves user on review page', async () => {
    storeMock.mockResolvedValue(store({ manualUpiEnabled: true, codEnabled: true, onlinePaymentEnabled: false }));
    cartMock.mockResolvedValue(cart());
    addressesMock.mockResolvedValue([address()]);

    const user = userEvent.setup();
    renderCheckout();

    await screen.findByText(/1 King St/);
    await user.click(screen.getByRole('button', { name: /Continue to review/i }));

    await screen.findByText('Review & place order');
    await user.click(screen.getByRole('radio', { name: /UPI \(scan to pay\)/i }));

    placeMock.mockResolvedValue(codOrder({
      id: 'order-999',
      orderNumber: 'ORD-999',
      paymentMethod: 'MANUAL_UPI',
      items: [{ id: 'it-1', productId: 'prod-1', productName: 'Signet Ring', sku: 'SR-1', unitPrice: 100, quantity: 1, subtotal: 100 }],
      manualUpiPayment: {
        token: 'AMA-999',
        vpa: 'store@upi',
        qrDataUri: 'data:image/png;base64,qr',
        amount: 100,
        currency: 'USD',
      },
    }));

    await user.click(screen.getByRole('button', { name: 'Place order' }));

    // QR pop-up appears
    expect(await screen.findByAltText(/Scan to pay via UPI/i)).toBeInTheDocument();

    // Clicking outside / backdrop does NOT close it
    const heading = screen.getByRole('heading', { name: 'Pay via UPI' });
    const backdrop = heading.closest('.fixed');
    if (backdrop) {
      (backdrop as HTMLElement).click();
    }
    expect(screen.getByAltText(/Scan to pay via UPI/i)).toBeInTheDocument();

    // Clicking cross button closes it, cancels the order, restores cart, stays on Review step
    const closeButton = screen.getByRole('button', { name: 'Close' });
    await user.click(closeButton);

    await waitFor(() => {
      expect(cancelMock).toHaveBeenCalledWith('order-999');
      expect(addToCartMock).toHaveBeenCalledWith('prod-1', 1, undefined);
    });

    // Modal is closed, Review & place order is still visible
    expect(screen.queryByAltText(/Scan to pay via UPI/i)).not.toBeInTheDocument();
    expect(screen.getByText('Review & place order')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalledWith(expect.stringContaining('/orders/'));
  });
});
