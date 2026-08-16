import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Home from './Home';
import { getPublicStore } from '@/api/store';
import { listBanners } from '@/api/banners';
import { getCategoryTree, getTopProducts, listProducts } from '@/api/catalog';
import type { BannerResponse, Page, ProductSummaryResponse } from '@/lib/types';

vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));
vi.mock('@/api/banners', () => ({ listBanners: vi.fn() }));
vi.mock('@/api/catalog', () => ({ getCategoryTree: vi.fn(), listProducts: vi.fn(), getTopProducts: vi.fn() }));

const store = vi.mocked(getPublicStore);
const banners = vi.mocked(listBanners);
const tree = vi.mocked(getCategoryTree);
const products = vi.mocked(listProducts);
const topProducts = vi.mocked(getTopProducts);

function banner(id: string, overrides: Partial<BannerResponse> = {}): BannerResponse {
  return {
    id,
    placement: 'HOME_HERO',
    imageUrl: `https://cdn.example.com/${id}.jpg`,
    mobileImageUrl: null,
    altText: `Campaign ${id}`,
    linkUrl: null,
    headline: null,
    subtext: null,
    ctaLabel: null,
    sortOrder: 0,
    active: true,
    startsAt: null,
    endsAt: null,
    live: true,
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
  store.mockResolvedValue({ slug: 'royal', name: 'Royal Test', currency: 'USD', codEnabled: true, onlinePaymentEnabled: true });
  tree.mockResolvedValue([]);
  products.mockResolvedValue(emptyPage());
  topProducts.mockResolvedValue([]);
  banners.mockResolvedValue([]);
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

  // ── Who gets the first screen ─────────────────────────────────────────
  //
  // The merchant's live campaign, if there is one. The brand statement stands in
  // when there is not — a storefront opening on a category grid has no first
  // screen at all, which is what naively moving the hero down would have caused.

  it('gives the first screen to the campaign when one is booked', async () => {
    banners.mockResolvedValue([banner('b1'), banner('b2', { sortOrder: 1 })]);
    renderWithProviders(<Home />);

    const promotions = await screen.findByRole('region', { name: /promotions/i });
    expect(promotions).toBeInTheDocument();
    // Several banners means it slides rather than showing only the first.
    expect(within(promotions).getByRole('button', { name: /next slide/i })).toBeInTheDocument();
  });

  it('keeps the brand statement on the first screen when nothing is booked', async () => {
    banners.mockResolvedValue([]);
    renderWithProviders(<Home />);

    expect(await screen.findByRole('heading', { level: 1, name: /fewer things/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /promotions/i })).not.toBeInTheDocument();
  });

  /** Said once. Shown at the top AND repeated below, it would read as filler. */
  it('shows the brand statement exactly once either way', async () => {
    banners.mockResolvedValue([banner('b1')]);
    const { unmount } = renderWithProviders(<Home />);
    await screen.findByRole('img', { name: /campaign b1/i });
    expect(screen.getAllByRole('heading', { level: 1, name: /fewer things/i })).toHaveLength(1);
    unmount();

    banners.mockResolvedValue([]);
    renderWithProviders(<Home />);
    await screen.findByRole('heading', { level: 1, name: /fewer things/i });
    expect(screen.getAllByRole('heading', { level: 1, name: /fewer things/i })).toHaveLength(1);
  });

  /** A slide that points somewhere has to be clickable, or the campaign is a poster. */
  it('links a slide that carries a URL', async () => {
    banners.mockResolvedValue([banner('b1', { linkUrl: '/products?tag=sale' })]);
    renderWithProviders(<Home />);

    const link = await screen.findByRole('link', { name: /campaign b1/i });
    expect(link).toHaveAttribute('href', '/products?tag=sale');
  });

  /** Merchant-supplied targets may leave the site, and must not get window.opener. */
  it('opens an external campaign target safely', async () => {
    banners.mockResolvedValue([banner('b1', { linkUrl: 'https://campaign.example.com' })]);
    renderWithProviders(<Home />);

    const link = await screen.findByRole('link', { name: /campaign b1/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders a product rail when products are returned', async () => {
    products.mockResolvedValue({ ...emptyPage(), content: [product('p1', 'Crown Jewel')], totalElements: 1, numberOfElements: 1, empty: false });
    renderWithProviders(<Home />);
    // Appears in both New arrivals and Featured rails.
    const cards = await screen.findAllByText('Crown Jewel');
    expect(cards.length).toBeGreaterThan(0);
  });
});
