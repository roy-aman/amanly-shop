import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Products from './Products';
import { getCategoryTree, listBrands, listProducts } from '@/api/catalog';
import type { BrandResponse, CategoryTreeResponse, Page, ProductSummaryResponse } from '@/lib/types';

vi.mock('@/api/catalog', () => ({ getCategoryTree: vi.fn(), listBrands: vi.fn(), listProducts: vi.fn() }));

const tree = vi.mocked(getCategoryTree);
const brandsMock = vi.mocked(listBrands);
const products = vi.mocked(listProducts);

const BRAND: BrandResponse = {
  id: 'b1',
  name: 'Royal Textiles',
  slug: 'royal-textiles',
  description: null,
  logoUrl: null,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function page(content: ProductSummaryResponse[]): Page<ProductSummaryResponse> {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    number: 0,
    size: 12,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

function product(id: string, stockQuantity = 5): ProductSummaryResponse {
  return {
    id,
    name: `Product ${id}`,
    slug: id,
    sku: id.toUpperCase(),
    price: 42,
    compareAtPrice: null,
    currency: 'USD',
    status: 'ACTIVE',
    categoryName: 'Rings',
    primaryImageUrl: null,
    stockQuantity,
  };
}

const CATEGORY: CategoryTreeResponse = {
  id: 'c1',
  name: 'Rings',
  slug: 'rings',
  sortOrder: 0,
  imageUrl: null,
  imageAltText: null,
  children: [],
};

/** A second root, so the category rail has something to choose between and renders. */
const CATEGORY_2: CategoryTreeResponse = { ...CATEGORY, id: 'c2', name: 'Belts', slug: 'belts' };

// Renders Products with a location probe so tests can assert the URL query string.
function renderPLP(initialEntry = '/products') {
  function Probe() {
    const loc = useLocation();
    return <span data-testid="loc-search">{loc.search}</span>;
  }
  function Wrapper({ children }: { children: ReactNode }) {
    const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Probe />
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<Products />, { wrapper: Wrapper });
}

function locSearch() {
  return screen.getByTestId('loc-search').textContent ?? '';
}

function categorySelect() {
  // The category <select> is the one containing the "All categories" option.
  return screen.getByRole('option', { name: 'All categories' }).closest('select') as HTMLSelectElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  tree.mockResolvedValue([CATEGORY, CATEGORY_2]);
  brandsMock.mockResolvedValue([BRAND]);
  products.mockResolvedValue(page([product('p1')]));
});

describe('Products (PLP)', () => {
  it('applying the category filter updates the URL and re-queries the API', async () => {
    const user = userEvent.setup();
    renderPLP();

    await screen.findByText('Product p1');
    await waitFor(() => expect(categorySelect()).toBeInTheDocument());

    await user.selectOptions(categorySelect(), 'c1');

    await waitFor(() => expect(locSearch()).toContain('categoryId=c1'));
    await waitFor(() =>
      expect(products).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: 'c1' })),
    );
  });

  /**
   * The rail and the select are two doors onto one fact. Both write `categoryId` to the URL, which
   * is the only reason they can never disagree — so the wiring, not the tile, is what is worth
   * pinning here.
   */
  it('the category rail narrows the catalogue the same way the filter select does', async () => {
    const user = userEvent.setup();
    renderPLP();

    await screen.findByText('Product p1');

    await user.click(await screen.findByRole('button', { name: 'Belts' }));

    await waitFor(() => expect(locSearch()).toContain('categoryId=c2'));
    await waitFor(() =>
      expect(products).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: 'c2' })),
    );
    // The select is the same control by another route, so it has to have moved too.
    await waitFor(() => expect(categorySelect()).toHaveValue('c2'));

    // Tapping the chosen one again is the way back to everything.
    await user.click(screen.getByRole('button', { name: 'Belts' }));
    await waitFor(() => expect(locSearch()).not.toContain('categoryId'));
  });

  /**
   * The merchant's banner and copy were saved by the admin and displayed nowhere at all — the
   * field's own hint promised a category page that was never built. They belong to a category, so
   * they appear only once a shopper has narrowed to one.
   */
  it('shows the category banner and copy once a category is chosen, and not before', async () => {
    tree.mockResolvedValue([
      { ...CATEGORY, bannerUrl: 'https://cdn.test/rings.jpg', description: 'Signet rings, cast in the round.' },
      CATEGORY_2,
    ]);
    const user = userEvent.setup();
    renderPLP();

    await screen.findByText('Product p1');
    // "Everything" has no one category whose banner this would be.
    expect(document.querySelector('img[alt=""]')).toBeNull();
    expect(screen.queryByText(/cast in the round/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rings' }));

    await waitFor(() =>
      expect(document.querySelector('img[alt=""]')).toHaveAttribute('src', 'https://cdn.test/rings.jpg'),
    );
    expect(screen.getByText('Signet rings, cast in the round.')).toBeInTheDocument();
  });

  /** A category with no banner must not leave a gap where one would have been. */
  it('renders no banner for a category that has none', async () => {
    const user = userEvent.setup();
    renderPLP();

    await screen.findByText('Product p1');
    await user.click(screen.getByRole('button', { name: 'Rings' }));

    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Rings'));
    expect(document.querySelector('img[alt=""]')).toBeNull();
  });

  it('titles the page after the category rather than calling every view "Shop"', async () => {
    const user = userEvent.setup();
    renderPLP();

    await screen.findByText('Product p1');
    expect(document.title).toContain('Shop');

    await user.click(screen.getByRole('button', { name: 'Rings' }));

    await waitFor(() => expect(document.title).toContain('Rings'));
  });

  it('applying the brand filter updates the URL and re-queries the API (WP-3.5)', async () => {
    const user = userEvent.setup();
    renderPLP();

    await screen.findByText('Product p1');
    const brandSelect = (await screen.findByRole('option', { name: 'All brands' })).closest(
      'select',
    ) as HTMLSelectElement;

    await user.selectOptions(brandSelect, 'b1');

    await waitFor(() => expect(locSearch()).toContain('brandId=b1'));
    await waitFor(() =>
      expect(products).toHaveBeenLastCalledWith(expect.objectContaining({ brandId: 'b1' })),
    );
  });

  it('clearing all filters removes them from the URL', async () => {
    const user = userEvent.setup();
    renderPLP('/products?categoryId=c1&inStock=1&minPrice=10');

    await screen.findByText('Product p1');

    // Active-filter chips + a "Clear all" affordance are shown.
    const clearAll = await screen.findByRole('button', { name: /clear all/i });
    await user.click(clearAll);

    await waitFor(() => {
      const s = locSearch();
      expect(s).not.toContain('categoryId');
      expect(s).not.toContain('inStock');
      expect(s).not.toContain('minPrice');
    });
  });

  it('changing a filter resets pagination to the first page', async () => {
    const user = userEvent.setup();
    renderPLP('/products?page=3');

    await screen.findByText('Product p1');
    await waitFor(() => expect(categorySelect()).toBeInTheDocument());

    await user.selectOptions(categorySelect(), 'c1');

    await waitFor(() => expect(locSearch()).not.toContain('page=3'));
    expect(locSearch()).toContain('categoryId=c1');
  });

  it('in-stock is a URL-synced client-side filter (no server param) over the loaded page', async () => {
    products.mockResolvedValue(page([product('in', 5), product('out', 0)]));
    const user = userEvent.setup();
    renderPLP();

    await screen.findByText('Product in');
    expect(screen.getByText('Product out')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /in stock/i }));

    // URL reflects the choice…
    await waitFor(() => expect(locSearch()).toContain('inStock=1'));
    // …the out-of-stock item is hidden client-side…
    await waitFor(() => expect(screen.queryByText('Product out')).not.toBeInTheDocument());
    expect(screen.getByText('Product in')).toBeInTheDocument();
    // …and no server-side availability param was ever sent.
    for (const call of products.mock.calls) {
      expect(call[0]).not.toHaveProperty('inStock');
      expect(call[0]).not.toHaveProperty('available');
    }
  });

  it('sort control offers only backend-backed fields (no popularity/rating)', async () => {
    renderPLP();
    await screen.findByText('Product p1');

    const sortSelect = screen.getByRole('combobox', { name: /sort products/i });
    const labels = within(sortSelect).getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['Newest', 'Price: low to high', 'Price: high to low', 'Name: A–Z']);
  });
});
