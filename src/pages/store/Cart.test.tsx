import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import Cart from './Cart';
import { addToCart, removeCartItem, updateCartItem } from '@/api/cart';
import { addToWishlist } from '@/api/wishlist';
import { validateCoupon } from '@/api/coupons';
import type { CartItemResponse, CartResponse, CouponPreviewResponse } from '@/lib/types';

vi.mock('@/api/cart', () => ({
  addToCart: vi.fn(),
  clearCart: vi.fn(),
  removeCartItem: vi.fn(),
  updateCartItem: vi.fn(),
}));

vi.mock('@/api/wishlist', () => ({ addToWishlist: vi.fn() }));
vi.mock('@/api/coupons', () => ({ validateCoupon: vi.fn() }));
// No commerce settings published in these tests, so the estimate stays absent
// and the panel keeps saying "calculated at checkout".
vi.mock('@/api/store', () => ({ getPublicStore: vi.fn().mockResolvedValue({ slug: 'royal', name: 'Royal', currency: 'USD', codEnabled: true, onlinePaymentEnabled: true }) }));

const wishlistRefresh = vi.fn();
vi.mock('@/context/WishlistContext', () => ({
  useWishlist: () => ({
    ids: new Set<string>(),
    count: 0,
    ready: true,
    isWishlisted: () => false,
    toggle: vi.fn(),
    refresh: wishlistRefresh,
  }),
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
const addWishlistMock = vi.mocked(addToWishlist);
const validateCouponMock = vi.mocked(validateCoupon);

function preview(overrides: Partial<CouponPreviewResponse> = {}): CouponPreviewResponse {
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
  // The page reads the store's delivery/tax rules through TanStack Query for the
  // pre-checkout estimate, so it needs a client as well as a router.
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Cart />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear(); // reset any persisted coupon between tests
  currentCart = cart([item()]);
  updateMock.mockResolvedValue(cart([item({ quantity: 3, subtotal: 300 })]));
  removeMock.mockResolvedValue(cart([]));
  addMock.mockResolvedValue(cart([item()]));
  addWishlistMock.mockResolvedValue({ productId: 'p1', wishlisted: true, wishlistCount: 1 });
  validateCouponMock.mockResolvedValue(preview());
});

describe('Cart (WP-2.4)', () => {
  it('increasing quantity calls updateCartItem and reconciles via setCart', async () => {
    const user = userEvent.setup();
    renderCart();

    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('p1', 3, undefined));
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

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('p1', undefined));
    const undoBtn = await screen.findByRole('button', { name: /undo/i });

    await user.click(undoBtn);
    await waitFor(() => expect(addMock).toHaveBeenCalledWith('p1', 2, undefined));
  });

  it('"save for later" adds to the wishlist then removes the cart line', async () => {
    const user = userEvent.setup();
    renderCart();

    await user.click(screen.getByRole('button', { name: 'Save Signet Ring for later' }));

    await waitFor(() => expect(addWishlistMock).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('p1', undefined));
    // Cart is reconciled from server truth and heart state is resynced.
    await waitFor(() => expect(setCart).toHaveBeenCalled());
    expect(wishlistRefresh).toHaveBeenCalled();
  });

  it('shows the variant label + SKU on a variant line and removes it variant-aware (WP-3.5)', async () => {
    const variantItem = item({
      cartItemId: 'ci-v',
      variantId: 'var-1',
      variantSku: 'RING-1-M-RED',
      variantOptionsLabel: 'color: Red, size: M',
    });
    currentCart = cart([variantItem]);
    removeMock.mockResolvedValue(cart([]));
    const user = userEvent.setup();
    renderCart();

    // The chosen options + the variant SKU are surfaced on the line.
    expect(screen.getByText('color: Red, size: M')).toBeInTheDocument();
    expect(screen.getByText('SKU: RING-1-M-RED')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Signet Ring' }));
    // Remove targets the specific variant line via its variantId.
    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('p1', 'var-1'));
  });

  it('renders a rich empty state with a Start shopping CTA', () => {
    currentCart = cart([]);
    renderCart();

    expect(screen.getByText('Your bag is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start shopping/i })).toHaveAttribute('href', '/products');
  });

  it('surfaces the reservation window and offers a working coupon input (WP-3.4)', () => {
    renderCart();
    expect(screen.getByText(/reserved for 12 min/i)).toBeInTheDocument();
    // Coupon entry is now live (WP-3.4) — the promo input is enabled.
    expect(screen.getByLabelText(/promo code/i)).toBeEnabled();
  });

  it('applying a valid coupon validates it and shows the discount (WP-3.4)', async () => {
    const user = userEvent.setup();
    renderCart();

    await user.type(screen.getByLabelText(/promo code/i), 'SAVE10');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() => expect(validateCouponMock).toHaveBeenCalledWith('SAVE10', 200));
    // Applied confirmation + discount line reflect the preview.
    expect(await screen.findByText(/Discount \(SAVE10\)/i)).toBeInTheDocument();
    expect(screen.getByText('−$20.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove coupon save10/i })).toBeInTheDocument();
  });

  it('applying an invalid coupon surfaces the rejection message (WP-3.4)', async () => {
    validateCouponMock.mockResolvedValue(
      preview({ valid: false, code: 'EXPIRED', reason: 'EXPIRED', message: 'This coupon has expired.', discountAmount: null, total: null }),
    );
    const user = userEvent.setup();
    renderCart();

    await user.type(screen.getByLabelText(/promo code/i), 'EXPIRED');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(await screen.findByText(/this coupon has expired/i)).toBeInTheDocument();
    // No discount line is shown for a rejected coupon.
    expect(screen.queryByText(/^Discount/i)).not.toBeInTheDocument();
  });
});
