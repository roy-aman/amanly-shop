import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Cart from './Cart';
import { addToCart, removeCartItem, updateCartItem } from '@/api/cart';
import type { CartItemResponse, CartResponse } from '@/lib/types';

vi.mock('@/api/cart', () => ({
  addToCart: vi.fn(),
  clearCart: vi.fn(),
  removeCartItem: vi.fn(),
  updateCartItem: vi.fn(),
}));

// Cart state lives in CartContext — stub it so the page drives real api calls
// while we observe cart/setCart/refresh directly.
const setCart = vi.fn();
const refresh = vi.fn();
let currentCart: CartResponse | null = null;
vi.mock('@/context/CartContext', () => ({
  useCart: () => ({ cart: currentCart, itemCount: 0, loading: false, refresh, setCart }),
}));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const updateMock = vi.mocked(updateCartItem);
const removeMock = vi.mocked(removeCartItem);
const addMock = vi.mocked(addToCart);

function item(overrides: Partial<CartItemResponse> = {}): CartItemResponse {
  return {
    cartItemId: 'ci1',
    productId: 'p1',
    productName: 'Signet Ring',
    productSlug: 'signet-ring',
    sku: 'RING-1',
    quantity: 2,
    unitPrice: 100,
    subtotal: 200,
    reservationRemainingMinutes: 12,
    ...overrides,
  };
}

function cart(items: CartItemResponse[]): CartResponse {
  return {
    cartId: 'cart1',
    userId: 'u1',
    items,
    totalAmount: items.reduce((s, i) => s + i.subtotal, 0),
    currency: 'USD',
  };
}

function renderCart() {
  return render(
    <MemoryRouter>
      <Cart />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  currentCart = cart([item()]);
  updateMock.mockResolvedValue(cart([item({ quantity: 3, subtotal: 300 })]));
  removeMock.mockResolvedValue(cart([]));
  addMock.mockResolvedValue(cart([item()]));
});

describe('Cart (WP-2.4)', () => {
  it('increasing quantity calls updateCartItem and reconciles via setCart', async () => {
    const user = userEvent.setup();
    renderCart();

    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('p1', 3));
    // Optimistic setCart + server-truth reconcile setCart both fire.
    await waitFor(() => expect(setCart).toHaveBeenCalled());
    const calls = setCart.mock.calls;
    const lastArg = calls[calls.length - 1][0] as CartResponse;
    expect(lastArg.items[0].quantity).toBe(3);
  });

  it('removing an item shows an undo affordance that re-adds via addToCart', async () => {
    const user = userEvent.setup();
    renderCart();

    await user.click(screen.getByRole('button', { name: 'Remove Signet Ring' }));

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('p1'));
    const undoBtn = await screen.findByRole('button', { name: /undo/i });

    await user.click(undoBtn);
    await waitFor(() => expect(addMock).toHaveBeenCalledWith('p1', 2));
  });

  it('renders a rich empty state with a Start shopping CTA', () => {
    currentCart = cart([]);
    renderCart();

    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start shopping/i })).toHaveAttribute('href', '/products');
  });

  it('surfaces the reservation window and disables the coupon input (WP-3.4)', () => {
    renderCart();
    expect(screen.getByText(/reserved for 12 min/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/promo code/i)).toBeDisabled();
  });
});
