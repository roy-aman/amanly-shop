import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/utils';
import Services from './Services';
import { listServiceCategories, listServices } from '@/api/services';
import { getPublicStore } from '@/api/store';
import type { Page, PublicStoreResponse, ServiceOfferingResponse } from '@/lib/types';

vi.mock('@/api/services', () => ({
  listServices: vi.fn(),
  listServiceCategories: vi.fn(),
}));
vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));

const listMock = vi.mocked(listServices);
const categoriesMock = vi.mocked(listServiceCategories);
const storeMock = vi.mocked(getPublicStore);

function store(overrides: Partial<PublicStoreResponse> = {}): PublicStoreResponse {
  return {
    slug: 'demo',
    name: 'Demo',
    currency: 'INR',
    codEnabled: true,
    onlinePaymentEnabled: false,
    bookingsEnabled: true,
    timezone: 'Asia/Kolkata',
    businessAddress: '12 High Street',
    ...overrides,
  };
}

function service(overrides: Partial<ServiceOfferingResponse> = {}): ServiceOfferingResponse {
  return {
    id: 'svc-1',
    categoryId: 'cat-1',
    categoryName: 'Treatments',
    name: 'Deep tissue massage',
    slug: 'deep-tissue-massage',
    description: 'Sixty minutes of firm pressure work.',
    price: 2400,
    currency: 'INR',
    durationMinutes: 60,
    imageUrl: null,
    imageAltText: null,
    ratingAvg: 4.6,
    ratingCount: 12,
    ...overrides,
  };
}

function page(content: ServiceOfferingResponse[]): Page<ServiceOfferingResponse> {
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

describe('Services', () => {
  beforeEach(() => {
    storeMock.mockResolvedValue(store());
    listMock.mockResolvedValue(page([service()]));
    categoriesMock.mockResolvedValue([
      { id: 'cat-1', name: 'Treatments', slug: 'treatments', sortOrder: 0, active: true },
    ]);
  });

  it('lists the menu with the duration a shopper compares on', async () => {
    renderWithProviders(<Services />);

    expect(await screen.findByText('Deep tissue massage')).toBeInTheDocument();
    expect(screen.getByText('1 hr')).toBeInTheDocument();
  });

  it('renders nothing of the services surface when the shop does not take bookings', async () => {
    // The whole point of the gate: without it every request under here 404s and
    // the customer gets a page of failures instead of an honest "no such page".
    storeMock.mockResolvedValue(store({ bookingsEnabled: false }));

    renderWithProviders(<Services />);

    expect(await screen.findByText(/page not found|not found/i)).toBeInTheDocument();
    expect(screen.queryByText('Deep tissue massage')).not.toBeInTheDocument();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('treats a store payload with no booking flag at all as bookings off', async () => {
    // A bundle can be live against a backend that predates the field, or reading
    // a payload cached before it existed. Undefined has to fail closed.
    storeMock.mockResolvedValue(store({ bookingsEnabled: undefined }));

    renderWithProviders(<Services />);

    expect(await screen.findByText(/page not found|not found/i)).toBeInTheDocument();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('says so plainly when the shop has published no services', async () => {
    listMock.mockResolvedValue(page([]));

    renderWithProviders(<Services />);

    expect(await screen.findByText('No services yet')).toBeInTheDocument();
  });

  it('asks the server for the menu in the merchant’s own order', async () => {
    // No sort parameter: services come back in the order the shop arranged them,
    // which for a menu is a considered running order rather than a default.
    renderWithProviders(<Services />);

    await screen.findByText('Deep tissue massage');
    expect(listMock).toHaveBeenCalledWith({ categoryId: undefined, q: undefined, page: 0, size: 12 });
  });
});
