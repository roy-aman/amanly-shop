import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import AddToBagButton from './AddToBagButton';
import { useCart } from '@/context/CartContext';
import type { CartItemResponse, ProductSummaryResponse } from '@/lib/types';

vi.mock('@/context/CartContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/context/CartContext')>()),
  useCart: vi.fn(),
}));

const useCartMock = vi.mocked(useCart);

const addProduct = vi.fn().mockResolvedValue(true);
const setProductQuantity = vi.fn().mockResolvedValue(true);
let line: CartItemResponse | null = null;

function product(overrides: Partial<ProductSummaryResponse> = {}): ProductSummaryResponse {
  return {
    id: 'p1',
    name: 'Ribbed Cotton Cap',
    slug: 'ribbed-cotton-cap',
    sku: 'CAP-1',
    price: 399,
    compareAtPrice: null,
    currency: 'INR',
    status: 'ACTIVE',
    categoryName: 'Caps',
    primaryImageUrl: null,
    stockQuantity: 5,
    ...overrides,
  };
}

function inBag(quantity: number): CartItemResponse {
  return {
    cartItemId: 'ci1',
    productId: 'p1',
    productName: 'Ribbed Cotton Cap',
    productSlug: 'ribbed-cotton-cap',
    sku: 'CAP-1',
    quantity,
    unitPrice: 399,
    subtotal: 399 * quantity,
    reservationRemainingMinutes: 12,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  line = null;
  useCartMock.mockImplementation(
    () =>
      ({
        cart: null,
        itemCount: 0,
        loading: false,
        refresh: vi.fn(),
        setCart: vi.fn(),
        lineFor: () => line,
        addProduct,
        setProductQuantity,
      }) as unknown as ReturnType<typeof useCart>,
  );
});

describe('AddToBagButton', () => {
  it('adds one to the bag from the card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddToBagButton product={product()} />);

    await user.click(screen.getByRole('button', { name: /add ribbed cotton cap to bag/i }));

    expect(addProduct).toHaveBeenCalledWith('p1', 1, 'Ribbed Cotton Cap');
  });

  it('becomes a stepper once the product is in the bag, and says how many', async () => {
    line = inBag(2);
    const user = userEvent.setup();
    renderWithProviders(<AddToBagButton product={product()} />);

    expect(screen.getByText('2 in bag')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add .* to bag/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /increase/i }));
    expect(setProductQuantity).toHaveBeenCalledWith('p1', 3, 'Ribbed Cotton Cap');
  });

  /** The only way out of the bag from a grid — there is no room for a separate delete control. */
  it('decreasing from one removes the line, and says so', async () => {
    line = inBag(1);
    const user = userEvent.setup();
    renderWithProviders(<AddToBagButton product={product()} />);

    await user.click(screen.getByRole('button', { name: /remove ribbed cotton cap from bag/i }));

    expect(setProductQuantity).toHaveBeenCalledWith('p1', 0, 'Ribbed Cotton Cap');
  });

  it('will not let the line grow past the stock that exists', () => {
    line = inBag(5);
    renderWithProviders(<AddToBagButton product={product({ stockQuantity: 5 })} />);

    expect(screen.getByRole('button', { name: /increase/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /decrease/i })).toBeEnabled();
  });

  /**
   * The reason this control did not exist before. A sized product cannot be added blind — the card
   * has no idea which SKU to take — so it offers the page where the choice is made instead of a
   * button that would fail with VARIANT_REQUIRED after the shopper had committed to it.
   */
  it('sends a product with variants to its page instead of guessing a SKU', () => {
    renderWithProviders(<AddToBagButton product={product({ hasVariants: true })} />);

    expect(screen.getByRole('link', { name: /choose options/i }))
      .toHaveAttribute('href', '/products/ribbed-cotton-cap');
    expect(screen.queryByRole('button', { name: /add .* to bag/i })).not.toBeInTheDocument();
    expect(addProduct).not.toHaveBeenCalled();
  });

  it('offers nothing to click when the product is sold out', () => {
    renderWithProviders(<AddToBagButton product={product({ stockQuantity: 0 })} />);

    expect(screen.getByRole('button', { name: /sold out/i })).toBeDisabled();
  });

  it('does not double-fire while a change is in flight', async () => {
    line = inBag(2);
    let release: (() => void) | undefined;
    setProductQuantity.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (release = () => resolve(true))),
    );
    const user = userEvent.setup();
    renderWithProviders(<AddToBagButton product={product()} />);

    const plus = screen.getByRole('button', { name: /increase/i });
    await user.click(plus);
    await user.click(plus);

    expect(setProductQuantity).toHaveBeenCalledTimes(1);
    release?.();
    await waitFor(() => expect(plus).toBeEnabled());
  });
});
