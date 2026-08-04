import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProductDetail from './ProductDetail';
import { getProduct, listProducts } from '@/api/catalog';
import { addToCart } from '@/api/cart';
import type {
  Page,
  ProductImageResponse,
  ProductResponse,
  ProductSummaryResponse,
  ProductVariantResponse,
} from '@/lib/types';

vi.mock('@/api/catalog', () => ({ getProduct: vi.fn(), listProducts: vi.fn() }));
vi.mock('@/api/cart', () => ({ addToCart: vi.fn() }));
// Contexts the buy box reads — stubbed so the page renders without app-wide providers.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('@/context/CartContext', () => ({ useCart: () => ({ refresh: vi.fn() }) }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const getProductMock = vi.mocked(getProduct);
const listProductsMock = vi.mocked(listProducts);
const addToCartMock = vi.mocked(addToCart);

function variant(overrides: Partial<ProductVariantResponse> = {}): ProductVariantResponse {
  return {
    id: 'var-m',
    sku: 'RING-1-M',
    options: { size: 'M' },
    optionsLabel: 'size: M',
    priceOverride: null,
    effectivePrice: 120,
    stockQuantity: 5,
    imageId: null,
    active: true,
    ...overrides,
  };
}

function image(id: string, url: string, sortOrder: number, isPrimary = false): ProductImageResponse {
  return { id, url, altText: `alt-${id}`, sortOrder, isPrimary };
}

function product(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 'p1',
    name: 'Signet Ring',
    slug: 'signet-ring',
    description: 'A fine ring.',
    shortDescription: 'Fine ring.',
    sku: 'RING-1',
    price: 120,
    compareAtPrice: 150,
    currency: 'USD',
    status: 'ACTIVE',
    categoryId: 'c1',
    categoryName: 'Rings',
    categorySlug: 'rings',
    weight: 5,
    sellingUnit: 'piece',
    stockQuantity: 8,
    tags: ['gold'],
    images: [image('i1', '/img-a.jpg', 0, true), image('i2', '/img-b.jpg', 1)],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function emptyPage(): Page<ProductSummaryResponse> {
  return {
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: 12,
    first: true,
    last: true,
    numberOfElements: 0,
    empty: true,
  };
}

function renderPDP(slug = 'signet-ring') {
  function Wrapper({ children }: { children: ReactNode }) {
    const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/products/${slug}`]}>
          <Routes>
            <Route path="/products/:slug" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<ProductDetail />, { wrapper: Wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getProductMock.mockResolvedValue(product());
  listProductsMock.mockResolvedValue(emptyPage());
});

describe('ProductDetail (PDP)', () => {
  it('switches the main image when a thumbnail is clicked', async () => {
    const user = userEvent.setup();
    renderPDP();

    await screen.findByRole('heading', { name: 'Signet Ring' });

    // Primary image (isPrimary) is shown first.
    expect(screen.getByTestId('pdp-main-image')).toHaveAttribute('src', '/img-a.jpg');

    await user.click(screen.getByRole('button', { name: 'Show image 2' }));

    expect(screen.getByTestId('pdp-main-image')).toHaveAttribute('src', '/img-b.jpg');
  });

  it('disables the add button and labels it "Out of stock" when stock is zero', async () => {
    getProductMock.mockResolvedValue(product({ stockQuantity: 0 }));
    renderPDP();

    const addBtn = await screen.findByRole('button', { name: /out of stock/i });
    expect(addBtn).toBeDisabled();
  });

  it('variantless product adds to cart without a variantId (WP-3.5)', async () => {
    const user = userEvent.setup();
    renderPDP();

    const addBtn = await screen.findByRole('button', { name: /add to bag/i });
    await user.click(addBtn);

    await waitFor(() => expect(addToCartMock).toHaveBeenCalledWith('p1', 1, undefined));
  });

  it('variant product requires a selection, then adds with the resolved variantId (WP-3.5)', async () => {
    getProductMock.mockResolvedValue(
      product({
        variants: [
          variant({ id: 'var-m', options: { size: 'M' }, optionsLabel: 'size: M', sku: 'RING-1-M' }),
          variant({ id: 'var-l', options: { size: 'L' }, optionsLabel: 'size: L', sku: 'RING-1-L', stockQuantity: 2 }),
        ],
      }),
    );
    const user = userEvent.setup();
    renderPDP();

    // Before choosing an option the CTA is disabled and prompts a selection.
    const preselect = await screen.findByRole('button', { name: /select options/i });
    expect(preselect).toBeDisabled();

    // Pick a size → the variant resolves and the CTA becomes "Add to bag".
    await user.click(screen.getByRole('radio', { name: /size: M/i }));
    const addBtn = await screen.findByRole('button', { name: /add to bag/i });
    await user.click(addBtn);

    await waitFor(() => expect(addToCartMock).toHaveBeenCalledWith('p1', 1, 'var-m'));
  });

  it('persists the viewed product to localStorage (recently viewed)', async () => {
    renderPDP();

    await screen.findByRole('heading', { name: 'Signet Ring' });

    const stored = JSON.parse(localStorage.getItem('rc-recently-viewed') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: 'p1', slug: 'signet-ring', primaryImageUrl: '/img-a.jpg' });
  });
});
