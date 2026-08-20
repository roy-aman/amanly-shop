import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '@/test/utils';
import AdminBookings from './AdminBookings';
import { adminBookings } from '@/api/bookings';
import { adminServices, getBusinessHours } from '@/api/services';
import { adminStaffProfiles } from '@/api/staff';
import { adminStore } from '@/api/admin';
import type { AdminBookingResponse, Page, StoreSettingsResponse } from '@/lib/types';

vi.mock('@/api/bookings', () => ({
  adminBookings: { list: vi.fn(), createWalkIn: vi.fn() },
}));
vi.mock('@/api/services', () => ({
  adminServices: { list: vi.fn() },
  getAvailability: vi.fn(),
  getBusinessHours: vi.fn(),
}));
vi.mock('@/api/staff', () => ({ adminStaffProfiles: { list: vi.fn() } }));
vi.mock('@/api/admin', () => ({ adminStore: { get: vi.fn() } }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));
// The diary now tells a staff member their view is narrowed, so the page reads
// the signed-in role.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }));

const listMock = vi.mocked(adminBookings.list);
const storeMock = vi.mocked(adminStore.get);

function settings(overrides: Partial<StoreSettingsResponse> = {}): StoreSettingsResponse {
  return {
    id: 's1',
    slug: 'demo',
    name: 'Demo',
    currency: 'INR',
    status: 'ACTIVE',
    codEnabled: true,
    onlinePaymentEnabled: false,
    razorpayKeyId: null,
    razorpayConfigured: false,
    whatsappEnabled: false,
    bookingsAllowed: true,
    bookingsEnabled: true,
    timezone: 'Asia/Kolkata',
    ...overrides,
  };
}

function page(content: AdminBookingResponse[]): Page<AdminBookingResponse> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 200,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

describe('AdminBookings', () => {
  beforeEach(() => {
    storeMock.mockResolvedValue(settings());
    listMock.mockResolvedValue(page([]));
    vi.mocked(adminStaffProfiles.list).mockResolvedValue([]);
    vi.mocked(adminServices.list).mockResolvedValue({ ...page([]), content: [] } as never);
    vi.mocked(getBusinessHours).mockResolvedValue({
      timezone: 'Asia/Kolkata',
      businessHours: [{ weekday: 1, openTime: '09:00', closeTime: '18:00' }],
    });
  });

  it('asks for exactly one day, bounded by the shop’s midnight', async () => {
    // The silent bug this prevents: building the span from the browser's
    // midnight drops the first and last appointments of the shop's day.
    renderWithProviders(<AdminBookings />);

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    const params = listMock.mock.calls[0][0]!;
    expect(params.from).toBeDefined();
    expect(params.to).toBeDefined();
    // Midnight in Asia/Kolkata is 18:30 UTC the day before.
    expect(params.from).toMatch(/T18:30:00\.000Z$/);
    expect(params.to).toMatch(/T18:30:00\.000Z$/);
    // Exactly 24 hours apart, and a single request rather than paging.
    const hours = (new Date(params.to!).getTime() - new Date(params.from!).getTime()) / 3600_000;
    expect(hours).toBe(24);
    expect(params.size).toBe(200);
  });

  it('opens on today rather than on a search screen', async () => {
    // A front desk opens this to see the day, not to look through history.
    renderWithProviders(<AdminBookings />);

    expect(await screen.findByRole('tab', { name: 'Today', selected: true })).toBeInTheDocument();
  });

  it('says the store has no such plan when the entitlement is missing', async () => {
    storeMock.mockResolvedValue(settings({ bookingsAllowed: false }));

    renderWithProviders(<AdminBookings />);

    expect(await screen.findByText(/aren’t part of this store’s plan/i)).toBeInTheDocument();
    expect(listMock).not.toHaveBeenCalled();
  });
});
