import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Checkout from './Checkout';
import { createTestQueryClient } from '@/test/utils';
import { getPublicStore } from '@/api/store';
import { getCart } from '@/api/cart';
import { placeOrder } from '@/api/orders';
import { listAddresses } from '@/api/addresses';
import type { AddressResponse, CartResponse, OrderResponse, PublicStoreResponse } from '@/lib/types';

vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));
vi.mock('@/api/cart', () => ({ getCart: vi.fn() }));
vi.mock('@/api/orders', () => ({ placeOrder: vi.fn(), verifyRazorpayPayment: vi.fn() }));
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
const addressesMock = vi.mocked(listAddresses);

function store(overrides: Partial<PublicStoreResponse> = {}): PublicStoreResponse {
  return { name: 'Royal', currency: 'USD', codEnabled: true, onlinePaymentEnabled: true, ...overrides };
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
  storeMock.mockResolvedValue(store());
  cartMock.mockResolvedValue(cart());
  addressesMock.mockResolvedValue([address()]);
});

describe('Checkout (WP-2.5)', () => {
  it('cannot advance past the Address step without a valid address', async () => {
    addressesMock.mockResolvedValue([]); // no saved addresses → inline form, nothing selected
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByText('Delivery address');
    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));

    // Stays on the Address step — Payment heading never appears.
    expect(screen.queryByText('Payment method')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/address/i);
  });

  it('payment methods reflect the store flags — COD only', async () => {
    storeMock.mockResolvedValue(store({ codEnabled: true, onlinePaymentEnabled: false }));
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByText('Delivery address');
    await user.click(await screen.findByRole('radio', { name: /Home/i }));
    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));

    await screen.findByText('Payment method');
    expect(screen.getByText('Cash on Delivery')).toBeInTheDocument();
    expect(screen.queryByText('UPI / Online payment')).not.toBeInTheDocument();
    expect(screen.getByText(/Online payment is currently unavailable/i)).toBeInTheDocument();
  });

  it('payment methods reflect the store flags — online only', async () => {
    storeMock.mockResolvedValue(store({ codEnabled: false, onlinePaymentEnabled: true }));
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByText('Delivery address');
    await user.click(await screen.findByRole('radio', { name: /Home/i }));
    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));

    await screen.findByText('Payment method');
    expect(screen.getByText('UPI / Online payment')).toBeInTheDocument();
    expect(screen.queryByText('Cash on Delivery')).not.toBeInTheDocument();
  });

  it('COD happy path: Place order calls placeOrder with the mapped shippingAddress and navigates', async () => {
    const order: OrderResponse = {
      id: 'o1',
      userId: 'u1',
      status: 'PENDING',
      paymentMethod: 'CASH',
      paymentStatus: 'PENDING',
      totalAmount: 200,
      currency: 'USD',
      shippingAddress: {
        name: 'Jane Doe', phone: '555-1', addressLine1: '1 King St', addressLine2: 'Apt 2',
        city: 'Metropolis', state: 'CA', postalCode: '90001', country: 'US',
      },
      notes: null,
      items: [],
      paymentAction: null, // COD → no Razorpay hand-off
      createdAt: '',
      updatedAt: '',
    };
    placeMock.mockResolvedValue(order);
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByText('Delivery address');
    await user.click(await screen.findByRole('radio', { name: /Home/i }));
    await user.click(screen.getByRole('button', { name: 'Continue to payment' }));

    await screen.findByText('Payment method');
    await user.click(screen.getByRole('button', { name: 'Continue to review' }));

    await screen.findByText('Review & place order');
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
      }),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/orders/o1'));
    expect(refresh).toHaveBeenCalled();
  });
});
