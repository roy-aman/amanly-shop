import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '@/test/utils';
import Home from './Home';
import { getPublicStore } from '@/api/store';
import { listServices } from '@/api/services';
import { getCategoryTree, getTopProducts, listProducts } from '@/api/catalog';
import { listBanners } from '@/api/banners';
import type { Page, PublicStoreResponse, ServiceOfferingResponse } from '@/lib/types';

vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));
vi.mock('@/api/services', () => ({ listServices: vi.fn() }));
vi.mock('@/api/catalog', () => ({
  getCategoryTree: vi.fn(),
  getTopProducts: vi.fn(),
  listProducts: vi.fn(),
}));
vi.mock('@/api/banners', () => ({ listBanners: vi.fn() }));

const storeMock = vi.mocked(getPublicStore);
const servicesMock = vi.mocked(listServices);

function store(bookingsEnabled?: boolean): PublicStoreResponse {
  return {
    slug: 'demo',
    name: 'Demo',
    currency: 'INR',
    codEnabled: true,
    onlinePaymentEnabled: false,
    bookingsEnabled,
    timezone: 'Asia/Kolkata',
    businessAddress: null,
  };
}

function service(): ServiceOfferingResponse {
  return {
    id: 'svc-1',
    categoryId: null,
    categoryName: null,
    name: 'Deep tissue massage',
    slug: 'deep-tissue-massage',
    description: null,
    price: 2400,
    currency: 'INR',
    durationMinutes: 60,
    imageUrl: null,
    imageAltText: null,
    ratingAvg: null,
    ratingCount: 0,
  };
}

function page<T>(content: T[]): Page<T> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 12,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

/**
 * The home page is the one existing screen this feature touches, so both
 * directions are pinned: it must gain a services rail for a shop that takes
 * bookings, and must be untouched for one that does not.
 */
describe('Home services rail', () => {
  beforeEach(() => {
    vi.mocked(getCategoryTree).mockResolvedValue([]);
    vi.mocked(getTopProducts).mockResolvedValue([]);
    vi.mocked(listProducts).mockResolvedValue(page([]));
    vi.mocked(listBanners).mockResolvedValue([]);
    servicesMock.mockResolvedValue(page([service()]));
  });

  it('shows the rail when the shop takes bookings', async () => {
    storeMock.mockResolvedValue(store(true));

    renderWithProviders(<Home />);

    expect(await screen.findByText('Book an appointment')).toBeInTheDocument();
    expect(await screen.findByText('Deep tissue massage')).toBeInTheDocument();
  });

  it('leaves a retail-only home page exactly as it was', async () => {
    // The condition for shipping this feature at all: a shop without bookings
    // must not gain a section, and must not make the request either.
    storeMock.mockResolvedValue(store(false));

    renderWithProviders(<Home />);

    await waitFor(() => expect(storeMock).toHaveBeenCalled());
    expect(screen.queryByText('Book an appointment')).not.toBeInTheDocument();
    expect(servicesMock).not.toHaveBeenCalled();
  });

  it('treats a missing flag as no bookings', async () => {
    storeMock.mockResolvedValue(store(undefined));

    renderWithProviders(<Home />);

    await waitFor(() => expect(storeMock).toHaveBeenCalled());
    expect(screen.queryByText('Book an appointment')).not.toBeInTheDocument();
    expect(servicesMock).not.toHaveBeenCalled();
  });

  it('hides the rail when the shop has bookings on but no services published', async () => {
    // An empty rail on the front page is worse than no rail.
    storeMock.mockResolvedValue(store(true));
    servicesMock.mockResolvedValue(page([]));

    renderWithProviders(<Home />);

    // The rail shows its heading while loading, like every other rail on this
    // page; what matters is that it takes itself away once the answer is empty.
    await waitFor(() => expect(screen.queryByText('Book an appointment')).not.toBeInTheDocument());
  });
});
