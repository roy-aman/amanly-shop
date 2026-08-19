import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DayTimeline } from './DayTimeline';
import type { AdminBookingResponse } from '@/lib/types';

function booking(overrides: Partial<AdminBookingResponse> = {}): AdminBookingResponse {
  return {
    id: 'bk-1',
    bookingNumber: 'BKG-1',
    serviceOfferingId: 'svc-1',
    serviceName: 'Massage',
    price: 2400,
    currency: 'INR',
    durationMinutes: 60,
    staffProfileId: null,
    staffName: null,
    startsAt: '2026-08-21T04:00:00Z', // 09:30 in Asia/Kolkata
    endsAt: '2026-08-21T05:00:00Z', // 10:30
    status: 'CONFIRMED',
    source: 'ONLINE',
    customerName: 'Ada L.',
    customerPhone: null,
    customerEmail: null,
    customerUserId: 'u1',
    notes: null,
    internalNote: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    bufferMinutes: 0,
    googleCalendarUrl: 'https://calendar.google.com',
    ...overrides,
  };
}

const KOLKATA = 'Asia/Kolkata';

/**
 * The timeline is the one place appointment times become geometry, so the
 * timezone error it could make is silent: blocks in the right order at the wrong
 * hour still look like a working screen.
 */
describe('DayTimeline', () => {
  it('places a block against the shop’s clock, not the viewer’s', async () => {
    const { container } = render(
      <DayTimeline
        bookings={[booking()]}
        timezone={KOLKATA}
        date="2026-08-21"
        hours={{ openTime: '09:00', closeTime: '18:00' }}
        onSelect={vi.fn()}
      />,
    );

    // Window is 08:00–19:00 (opening hours ±1h) = 660 minutes. The booking
    // starts at 09:30 shop time, which is 90 minutes in: 90/660 ≈ 13.6%.
    const block = container.querySelector<HTMLElement>('button[style*="top"]');
    expect(block).not.toBeNull();
    const top = parseFloat(block!.style.top);
    expect(top).toBeGreaterThan(12);
    expect(top).toBeLessThan(15);
  });

  it('gives overlapping appointments a lane each', () => {
    // Two people in the chair at once is normal for a shop with capacity; they
    // must sit side by side rather than on top of one another.
    render(
      <DayTimeline
        bookings={[
          booking({ id: 'a', customerName: 'Ada L.' }),
          booking({ id: 'b', customerName: 'Grace H.' }),
        ]}
        timezone={KOLKATA}
        date="2026-08-21"
        hours={{ openTime: '09:00', closeTime: '18:00' }}
        onSelect={vi.fn()}
      />,
    );

    const ada = screen.getByText('Ada L.').closest('button')!;
    const grace = screen.getByText('Grace H.').closest('button')!;
    expect(ada.style.left).not.toBe(grace.style.left);
    // Half width each, so both fit.
    expect(ada.style.width).toContain('50%');
  });

  it('lets a sequence of appointments share one lane', () => {
    render(
      <DayTimeline
        bookings={[
          booking({ id: 'a', customerName: 'Ada L.' }),
          booking({
            id: 'b',
            customerName: 'Grace H.',
            startsAt: '2026-08-21T05:00:00Z',
            endsAt: '2026-08-21T06:00:00Z',
          }),
        ]}
        timezone={KOLKATA}
        date="2026-08-21"
        hours={{ openTime: '09:00', closeTime: '18:00' }}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('Ada L.').closest('button')!.style.width).toContain('100%');
  });

  it('stretches the day to include something booked outside opening hours', () => {
    // A walk-in taken after closing still has to be visible, or the person who
    // took it cannot find it again.
    render(
      <DayTimeline
        bookings={[
          booking({
            startsAt: '2026-08-21T15:00:00Z', // 20:30 shop time
            endsAt: '2026-08-21T16:00:00Z',
            customerName: 'Late one',
          }),
        ]}
        timezone={KOLKATA}
        date="2026-08-21"
        hours={{ openTime: '09:00', closeTime: '18:00' }}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('Late one')).toBeInTheDocument();
  });

  it('says the day is empty rather than drawing a blank grid', () => {
    render(
      <DayTimeline bookings={[]} timezone={KOLKATA} date="2026-08-21" hours={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText(/nothing booked for this day/i)).toBeInTheDocument();
  });

  it('opens the booking that was clicked', async () => {
    const onSelect = vi.fn();
    render(
      <DayTimeline
        bookings={[booking()]}
        timezone={KOLKATA}
        date="2026-08-21"
        hours={{ openTime: '09:00', closeTime: '18:00' }}
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByText('Ada L.'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'bk-1' }));
  });
});
