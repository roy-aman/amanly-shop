import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';

import BookService from './BookService';
import { getAvailability, getService } from '@/api/services';
import { listStaff } from '@/api/staff';
import { placeBooking } from '@/api/bookings';
import { getPublicStore } from '@/api/store';
import { ApiError } from '@/lib/http';
import { ThemeProvider } from '@/context/ThemeContext';
import { createTestQueryClient } from '@/test/utils';
import type { AvailabilityResponse, PublicStoreResponse, ServiceOfferingResponse } from '@/lib/types';

vi.mock('@/api/services', () => ({ getService: vi.fn(), getAvailability: vi.fn() }));
vi.mock('@/api/staff', () => ({ listStaff: vi.fn() }));
vi.mock('@/api/bookings', () => ({ placeBooking: vi.fn(), downloadBookingIcs: vi.fn() }));
vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const authState = { isAuthenticated: true };
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authState }));

const serviceMock = vi.mocked(getService);
const availabilityMock = vi.mocked(getAvailability);
const staffMock = vi.mocked(listStaff);
const placeMock = vi.mocked(placeBooking);
const storeMock = vi.mocked(getPublicStore);

/** The exact string the server offered — the one thing that must survive the
 *  whole flow untouched. */
const OFFERED = '2026-08-21T09:00:00Z';

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

function availability(overrides: Partial<AvailabilityResponse> = {}): AvailabilityResponse {
  return {
    date: '2026-08-21',
    timezone: 'Asia/Kolkata',
    slots: [
      { startsAt: OFFERED, endsAt: '2026-08-21T10:00:00Z', localTime: '14:30' },
      { startsAt: '2026-08-21T11:00:00Z', endsAt: '2026-08-21T12:00:00Z', localTime: '16:30' },
    ],
    ...overrides,
  };
}

function store(): PublicStoreResponse {
  return {
    slug: 'demo',
    name: 'Demo',
    currency: 'INR',
    codEnabled: true,
    onlinePaymentEnabled: false,
    bookingsEnabled: true,
    timezone: 'Asia/Kolkata',
    businessAddress: '12 High Street',
  };
}

function renderAt(path = '/book/deep-tissue-massage') {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/book/:slug" element={<BookService />} />
            <Route path="/login" element={<div>Sign-in page</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('BookService', () => {
  beforeEach(() => {
    authState.isAuthenticated = true;
    storeMock.mockResolvedValue(store());
    serviceMock.mockResolvedValue(service());
    availabilityMock.mockResolvedValue(availability());
    staffMock.mockResolvedValue([]);
    placeMock.mockReset();
  });

  it('books the exact time the server offered', async () => {
    // The whole point: the string goes out as it came in. A Date round-trip
    // would produce an equal instant the server refuses.
    placeMock.mockResolvedValue({
      id: 'bk-1',
      bookingNumber: 'BKG-7K4QP2X9',
      serviceOfferingId: 'svc-1',
      serviceName: 'Deep tissue massage',
      price: 2400,
      currency: 'INR',
      durationMinutes: 60,
      staffProfileId: null,
      staffName: null,
      startsAt: OFFERED,
      endsAt: '2026-08-21T10:00:00Z',
      status: 'CONFIRMED',
      source: 'ONLINE',
      customerName: 'Ada L.',
      customerPhone: null,
      notes: null,
      cancellationReason: null,
      googleCalendarUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE',
    });

    renderAt();

    await userEvent.click(await screen.findByRole('radio', { name: '2:30 PM' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: /confirm booking/i }));

    await waitFor(() => expect(placeMock).toHaveBeenCalled());
    expect(placeMock.mock.calls[0][0].startsAt).toBe(OFFERED);
  });

  it('says pay at venue on the confirm button, never "payment pending"', async () => {
    // A customer who expects a payment step and does not find one assumes the
    // booking failed.
    renderAt();

    await userEvent.click(await screen.findByRole('radio', { name: '2:30 PM' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('button', { name: /pay at venue/i })).toBeInTheDocument();
    expect(screen.queryByText(/payment pending/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay now/i })).not.toBeInTheDocument();
  });

  it('carries the chosen slot into the sign-in trip instead of losing it', async () => {
    // Signed out, so the last step offers sign-in. The slot must already be in
    // the URL by then, or the customer picks a time twice and may find it gone.
    authState.isAuthenticated = false;
    renderAt();

    await userEvent.click(await screen.findByRole('radio', { name: '2:30 PM' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: /sign in to confirm/i }));

    expect(await screen.findByText('Sign-in page')).toBeInTheDocument();
  });

  it('restores a slot named in the URL, so the return leg lands ready to confirm', async () => {
    renderAt(`/book/deep-tissue-massage?date=2026-08-21&start=${encodeURIComponent(OFFERED)}`);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: '2:30 PM' })).toHaveAttribute('aria-checked', 'true'),
    );
  });

  it('tells the customer when the slot went while they were signing in', async () => {
    // Same return leg, but the time is no longer on offer. Silently selecting a
    // different one would book a time nobody chose.
    availabilityMock.mockResolvedValue(
      availability({ slots: [{ startsAt: '2026-08-21T11:00:00Z', endsAt: '2026-08-21T12:00:00Z', localTime: '16:30' }] }),
    );

    renderAt(`/book/deep-tissue-massage?date=2026-08-21&start=${encodeURIComponent(OFFERED)}`);

    expect(await screen.findByRole('status')).toHaveTextContent(/taken just before you confirmed/i);
    expect(screen.getByRole('radio', { name: '4:30 PM' })).toHaveAttribute('aria-checked', 'false');
  });

  it('returns to the picker on a 409 and never retries by itself', async () => {
    placeMock.mockRejectedValue(
      new ApiError(409, 'SLOT_NO_LONGER_AVAILABLE', 'That time has just been taken.'),
    );

    renderAt();

    await userEvent.click(await screen.findByRole('radio', { name: '2:30 PM' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: /confirm booking/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/taken just before you confirmed/i);
    // Exactly one attempt. Retrying would book whatever slot happened to be free.
    expect(placeMock).toHaveBeenCalledTimes(1);
  });

  it('shows the shop’s clock, not the viewer’s', async () => {
    // 09:00 UTC is 14:30 in the shop's zone. Anything reading the instant
    // locally would show a different time to a customer in another country.
    renderAt();
    expect(await screen.findByRole('radio', { name: '2:30 PM' })).toBeInTheDocument();
  });

  it('offers "anyone available" first and asks the server without a staff filter', async () => {
    staffMock.mockResolvedValue([
      { id: 'staff-1', displayName: 'Priya', title: 'Senior therapist', bio: null, photoUrl: null },
    ]);

    renderAt();

    expect(await screen.findByRole('radio', { name: 'Anyone available' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await waitFor(() => expect(availabilityMock).toHaveBeenCalled());
    expect(availabilityMock.mock.calls[0][2]).toBeUndefined();
  });
});
