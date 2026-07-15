import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Wishlist from './Wishlist';
import { WishlistProvider } from '@/context/WishlistContext';
import { getWishlist, getWishlistIds } from '@/api/wishlist';
import type { ProductSummaryResponse } from '@/lib/types';

// The page renders under an authenticated user (RequireAuth guards the route).
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/api/wishlist', () => ({
  getWishlist: vi.fn(),
  getWishlistIds: vi.fn(),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
}));

const listMock = vi.mocked(getWishlist);
const idsMock = vi.mocked(getWishlistIds);

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
    categoryName: 'Rings',
    primaryImageUrl: null,
    stockQuantity: 5,
  };
}

function renderWishlist() {
  function Wrapper({ children }: { children: ReactNode }) {
    const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <WishlistProvider>{children}</WishlistProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<Wishlist />, { wrapper: Wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  idsMock.mockResolvedValue([]);
  listMock.mockResolvedValue([]);
});

describe('Wishlist page (WP-3.3b)', () => {
  it('lists saved products as cards', async () => {
    idsMock.mockResolvedValue(['p1', 'p2']);
    listMock.mockResolvedValue([product('p1', 'Signet Ring'), product('p2', 'Gold Band')]);
    renderWishlist();

    expect(await screen.findByText('Signet Ring')).toBeInTheDocument();
    expect(screen.getByText('Gold Band')).toBeInTheDocument();
  });

  it('renders a rich empty state with a browse CTA when the wishlist is empty', async () => {
    renderWishlist();

    expect(await screen.findByText('Your wishlist is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse products/i })).toHaveAttribute('href', '/products');
  });
});
