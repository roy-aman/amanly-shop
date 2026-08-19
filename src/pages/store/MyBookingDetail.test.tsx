import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import MyBookingDetail from './MyBookingDetail';
import { cancelBooking, getMyBooking, rescheduleBooking } from '@/api/bookings';
import { getAvailability } from '@/api/services';
import { getPublicStore } from '@/api/store';
import { ApiError } from '@/lib/http';
import { ThemeProvider } from '@/context/ThemeContext';
import { createTestQueryClient } from '@/test/utils';
import type { BookingResponse, PublicStoreResponse } from '@/lib/types';

vi.mock('@/api/bookings', () => ({
  getMyBooking: vi.fn(),
  cancelBooking: vi.fn(),
  rescheduleBooking: vi.fn(),
  downloadBookingIcs: vi.fn(),
}));
vi.mock('@/api/services', () => ({ getAvailability: vi.fn() }));
vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const bookingMock = vi.mocked(getMyBooking);
const cancelMock = vi.mocked(cancelBooking);
const rescheduleMock = vi.mocked(rescheduleBooking);
const availabilityMock = vi.mocked(getAvailability);
const storeMock = vi.mocked(getPublicStore);

/** Far enough ahead that it is unambiguously upcoming whenever this runs. */
const FUTURE = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
const PAST = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

function booking(overrides: Partial<BookingResponse> = {}): BookingResponse {
  return {
    id: 'bk-1',
    bookingNumber: 'BKG-7K4QP2X9',
    serviceOfferingId: 'svc-1',
    serviceName: 'Deep tissue massage',
    price: 2400,
    currency: 'INR',
    durationMinutes: 60,
    staffProfileId: null,
    staffName: null,
    startsAt: FUTURE,
    endsAt: FUTURE,
    status: 'CONFIRMED',
    source: 'ONLINE',
    customerName: 'Ada L.',
    customerPhone: null,
    notes: null,
    cancellationReason: null,
    googleCalendarUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE',
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

function renderPage() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/account/bookings/bk-1']}>
          <Routes>
            <Route path="/account/bookings/:id" element={<MyBookingDetail />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('MyBookingDetail', () => {
  beforeEach(() => {
    storeMock.mockResolvedValue(store());
    bookingMock.mockResolvedValue(booking());
    cancelMock.mockReset();
    rescheduleMock.mockReset();
    availabilityMock.mockResolvedValue({
      date: '2026-08-21',
      timezone: 'Asia/Kolkata',
      slots: [{ startsAt: '2026-08-21T09:00:00Z', endsAt: '2026-08-21T10:00:00Z', localTime: '14:30' }],
    });
  });

  it('offers both changes on an upcoming confirmed booking', async () => {
    // Offered to everyone, because the shop's cut-off is not readable from here
    // and hiding the buttons would hide them from people who could still use them.
    renderPage();

    expect(await screen.findByRole('button', { name: /cancel booking/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /move to another time/i })).toBeInTheDocument();
  });

  it('offers no changes once the appointment has been', async () => {
    bookingMock.mockResolvedValue(booking({ startsAt: PAST, endsAt: PAST, status: 'COMPLETED' }));

    renderPage();

    await screen.findByText('Deep tissue massage');
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument();
  });

  it('points at the phone when the shop’s cut-off has passed', async () => {
    // The server is the boundary here, and its refusal has to arrive as a way
    // forward rather than as a dead end.
    cancelMock.mockRejectedValue(
      new ApiError(409, 'BOOKING_CUTOFF_PASSED', 'Too close to the appointment.'),
    );

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /cancel booking/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, cancel it' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/contact the store/i);
  });

  it('sends the reason along when one is given', async () => {
    cancelMock.mockResolvedValue(booking({ status: 'CANCELLED' }));

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /cancel booking/i }));
    await userEvent.type(screen.getByLabelText('Reason for cancelling'), 'Something came up');
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, cancel it' }));

    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith('bk-1', 'Something came up'));
  });

  it('promises the booking number survives a move, because people expect a duplicate', async () => {
    renderPage();

    expect(await screen.findByText(/same booking number/i)).toBeInTheDocument();
  });

  it('moves the booking to the exact slot the server offered', async () => {
    rescheduleMock.mockResolvedValue(booking());

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /move to another time/i }));
    await userEvent.click(await screen.findByRole('radio', { name: '2:30 PM' }));
    await userEvent.click(screen.getByRole('button', { name: /move to this time/i }));

    await waitFor(() => expect(rescheduleMock).toHaveBeenCalledWith('bk-1', '2026-08-21T09:00:00Z'));
  });

  it('keeps the same practitioner when looking for a new time', async () => {
    // Moving an appointment must not quietly reassign the person the customer
    // asked for.
    bookingMock.mockResolvedValue(booking({ staffProfileId: 'staff-1', staffName: 'Priya' }));

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /move to another time/i }));

    await waitFor(() => expect(availabilityMock).toHaveBeenCalled());
    expect(availabilityMock.mock.calls[0][2]).toBe('staff-1');
  });
});
