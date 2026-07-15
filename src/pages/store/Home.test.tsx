import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Home from './Home';
import { getPublicStore } from '@/api/store';
import { getCategoryTree, getTopProducts, listProducts } from '@/api/catalog';
import type { Page, ProductSummaryResponse } from '@/lib/types';

vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));
vi.mock('@/api/catalog', () => ({ getCategoryTree: vi.fn(), listProducts: vi.fn(), getTopProducts: vi.fn() }));

const store = vi.mocked(getPublicStore);
const tree = vi.mocked(getCategoryTree);
const products = vi.mocked(listProducts);
const topProducts = vi.mocked(getTopProducts);

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

function product(id: string, name: string): ProductSummaryResponse {
  return {
    id,
    name,
    slug: id,
    sku: id.toUpperCase(),
    price: 42,
    compareAtPrice: null,
    currency: 'USD',
    status: 'ACTIVE',
    categoryName: 'Cat',
    primaryImageUrl: null,
    stockQuantity: 5,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  store.mockResolvedValue({ name: 'Royal Test', currency: 'USD', codEnabled: true, onlinePaymentEnabled: true });
  tree.mockResolvedValue([]);
  products.mockResolvedValue(emptyPage());
  topProducts.mockResolvedValue([]);
});

describe('Home', () => {
  it('renders the hero with a shop CTA to /products', async () => {
    renderWithProviders(<Home />);
    const cta = await screen.findByRole('link', { name: /shop the collection/i });
    expect(cta).toHaveAttribute('href', '/products');
  });

  it('renders the best-sellers rail from /products/top when products are returned', async () => {
    topProducts.mockResolvedValue([product('b1', 'Royal Bestseller')]);
    renderWithProviders(<Home />);
    // Wait for the resolved product card (the heading also shows during loading).
    expect(await screen.findByText('Royal Bestseller')).toBeInTheDocument();
    expect(screen.getByText('Best sellers')).toBeInTheDocument();
  });

  it('hides the best-sellers rail entirely when nothing has sold ([])', async () => {
    topProducts.mockResolvedValue([]);
    renderWithProviders(<Home />);
    await screen.findByRole('link', { name: /shop the collection/i });
    // The heading shows during the loading skeleton, then the rail removes itself
    // once the empty [] resolves — wait for it to disappear.
    await waitFor(() => expect(screen.queryByText('Best sellers')).not.toBeInTheDocument());
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  });

  it('renders the trust row value props', async () => {
    renderWithProviders(<Home />);
    expect(await screen.findByText('Secure checkout')).toBeInTheDocument();
    expect(screen.getByText('Fast, tracked delivery')).toBeInTheDocument();
  });

  it('gracefully shows an empty-state for categories when none exist', async () => {
    renderWithProviders(<Home />);
    expect(await screen.findByText('Categories coming soon')).toBeInTheDocument();
  });

  it('renders a product rail when products are returned', async () => {
    products.mockResolvedValue({ ...emptyPage(), content: [product('p1', 'Crown Jewel')], totalElements: 1, numberOfElements: 1, empty: false });
    renderWithProviders(<Home />);
    // Appears in both New arrivals and Featured rails.
    const cards = await screen.findAllByText('Crown Jewel');
    expect(cards.length).toBeGreaterThan(0);
  });
});
