import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Home from './Home';
import { getPublicStore } from '@/api/store';
import { getCategoryTree, listProducts } from '@/api/catalog';
import type { Page, ProductSummaryResponse } from '@/lib/types';

vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));
vi.mock('@/api/catalog', () => ({ getCategoryTree: vi.fn(), listProducts: vi.fn() }));

const store = vi.mocked(getPublicStore);
const tree = vi.mocked(getCategoryTree);
const products = vi.mocked(listProducts);

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
});

describe('Home', () => {
  it('renders the hero with a shop CTA to /products', async () => {
    renderWithProviders(<Home />);
    const cta = await screen.findByRole('link', { name: /shop the collection/i });
    expect(cta).toHaveAttribute('href', '/products');
  });

  it('renders the best-sellers placeholder (blocked on WP-3.1) with a coming-soon badge', async () => {
    renderWithProviders(<Home />);
    expect(await screen.findByText('Best sellers')).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
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
