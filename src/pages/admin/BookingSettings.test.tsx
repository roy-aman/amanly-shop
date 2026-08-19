import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/utils';
import BookingSettings from './BookingSettings';
import { adminBookingSettings } from '@/api/bookings';
import type { BookingSettingsResponse } from '@/lib/types';

/** The form is long enough to carry Save at the top and the bottom; either will
 *  do, so the tests take the first. */
async function clickSave() {
  const buttons = await screen.findAllByRole('button', { name: 'Save changes' });
  await userEvent.click(buttons[0]);
}


vi.mock('@/api/bookings', () => ({
  adminBookingSettings: { get: vi.fn(), update: vi.fn() },
}));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const getMock = vi.mocked(adminBookingSettings.get);
const updateMock = vi.mocked(adminBookingSettings.update);

function settings(overrides: Partial<BookingSettingsResponse> = {}): BookingSettingsResponse {
  return {
    bookingsAllowed: true,
    bookingsEnabled: true,
    timezone: 'Asia/Kolkata',
    businessAddress: '12 High Street',
    slotGranularityMinutes: 30,
    maxConcurrentBookings: 2,
    minLeadTimeMinutes: 60,
    maxAdvanceDays: 30,
    cancellationCutoffHours: 4,
    reminderHoursBeforeFirst: 24,
    reminderHoursBeforeSecond: 2,
    whatsappConfirmationTemplate: null,
    whatsappReminderTemplate: null,
    businessHours: [
      { weekday: 1, openTime: '09:00', closeTime: '18:00' },
      { weekday: 2, openTime: '09:00', closeTime: '18:00' },
    ],
    ...overrides,
  };
}

describe('BookingSettings', () => {
  beforeEach(() => {
    getMock.mockResolvedValue(settings());
    updateMock.mockReset();
    updateMock.mockResolvedValue(settings());
  });

  it('sends the complete settings back, because the save replaces everything', async () => {
    // The trap in a full-replace PUT: anything omitted is not "unchanged", it is
    // gone — and an omitted week closes the shop.
    renderWithProviders(<BookingSettings />);

    await clickSave();

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateMock.mock.calls[0][0]).toEqual({
      bookingsEnabled: true,
      timezone: 'Asia/Kolkata',
      businessAddress: '12 High Street',
      slotGranularityMinutes: 30,
      maxConcurrentBookings: 2,
      minLeadTimeMinutes: 60,
      maxAdvanceDays: 30,
      cancellationCutoffHours: 4,
      reminderHoursBeforeFirst: 24,
      reminderHoursBeforeSecond: 2,
      whatsappConfirmationTemplate: null,
      whatsappReminderTemplate: null,
      businessHours: [
        { weekday: 1, openTime: '09:00', closeTime: '18:00' },
        { weekday: 2, openTime: '09:00', closeTime: '18:00' },
      ],
    });
  });

  it('drops a day from the week entirely when it is closed', async () => {
    // Closed is the absence of an entry, not a flag on one. Sending an entry
    // with empty times would be a different thing to the server.
    renderWithProviders(<BookingSettings />);

    await userEvent.click(await screen.findByLabelText('Open on Monday'));
    await clickSave();

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateMock.mock.calls[0][0].businessHours).toEqual([
      { weekday: 2, openTime: '09:00', closeTime: '18:00' },
    ]);
  });

  it('adds a day back with usable hours rather than two empty boxes', async () => {
    renderWithProviders(<BookingSettings />);

    await userEvent.click(await screen.findByLabelText('Open on Wednesday'));

    expect(screen.getByLabelText('Wednesday opening time')).toHaveValue('09:00');
    expect(screen.getByLabelText('Wednesday closing time')).toHaveValue('17:00');
  });

  it('warns when every day has been switched off', async () => {
    getMock.mockResolvedValue(settings({ businessHours: [] }));

    renderWithProviders(<BookingSettings />);

    expect(await screen.findByText(/every day is closed/i)).toBeInTheDocument();
  });

  it('refuses a second reminder that is further out than the first', async () => {
    // The server enforces it too; catching it here saves a round trip and says
    // which field is wrong.
    renderWithProviders(<BookingSettings />);

    const second = await screen.findByLabelText('Second reminder hours before');
    await userEvent.clear(second);
    await userEvent.type(second, '48');
    await clickSave();

    expect(await screen.findByText(/closer to the appointment/i)).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('says the store has no such plan, distinctly from bookings being off', async () => {
    // Two very different situations: one is a conversation with the platform,
    // the other is a toggle on this very page.
    getMock.mockResolvedValue(settings({ bookingsAllowed: false }));

    renderWithProviders(<BookingSettings />);

    expect(await screen.findByText(/aren’t part of this store’s plan/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Save changes' })).toHaveLength(0);
  });

  it('shows a setup banner when bookings are allowed but switched off', async () => {
    getMock.mockResolvedValue(settings({ bookingsEnabled: false }));

    renderWithProviders(<BookingSettings />);

    expect(await screen.findByText(/bookings are switched off/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Save changes' }).length).toBeGreaterThan(0);
  });
});
