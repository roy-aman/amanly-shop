import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DateStrip } from './DateStrip';
import { SlotPicker } from './SlotPicker';
import type { AvailabilitySlot } from '@/lib/types';

function slot(localTime: string, startsAt = `2026-08-21T00:00:00Z`): AvailabilitySlot {
  return { startsAt, endsAt: startsAt, localTime };
}

describe('SlotPicker', () => {
  it('hands back the whole slot so the caller can post the exact instant', async () => {
    // The single most important behaviour in the booking flow: the server
    // refuses times it did not offer, so the picker must not reduce a slot to
    // its label and let the caller rebuild the instant from it.
    const onChange = vi.fn();
    const offered = slot('14:30', '2026-08-21T09:00:00Z');
    render(<SlotPicker slots={[offered]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: '2:30 PM' }));

    expect(onChange).toHaveBeenCalledWith(offered);
    expect(onChange.mock.calls[0][0].startsAt).toBe('2026-08-21T09:00:00Z');
  });

  it('renders the shop-local label, never the viewer’s reading of the instant', () => {
    // The instant here is 09:00 UTC. If anything formatted it locally the label
    // would move with the test runner's zone; localTime pins it to the shop's.
    render(<SlotPicker slots={[slot('14:30', '2026-08-21T09:00:00Z')]} onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: '2:30 PM' })).toBeInTheDocument();
  });

  it('splits the day at noon and five, inclusive of the boundaries', async () => {
    render(
      <SlotPicker
        slots={[slot('11:59'), slot('12:00'), slot('16:59'), slot('17:00')]}
        onChange={vi.fn()}
      />,
    );

    const morning = screen.getByRole('radiogroup', { name: 'Morning times' });
    const afternoon = screen.getByRole('radiogroup', { name: 'Afternoon times' });
    const evening = screen.getByRole('radiogroup', { name: 'Evening times' });

    expect(within(morning).getByRole('radio', { name: '11:59 AM' })).toBeInTheDocument();
    expect(within(afternoon).getByRole('radio', { name: '12:00 PM' })).toBeInTheDocument();
    expect(within(afternoon).getByRole('radio', { name: '4:59 PM' })).toBeInTheDocument();
    expect(within(evening).getByRole('radio', { name: '5:00 PM' })).toBeInTheDocument();
  });

  it('treats an empty day as a normal answer, not as a failure', () => {
    // A shop closed on Sunday must not look like an outage. No alert role, no
    // error styling — just the fact and the next move.
    render(<SlotPicker slots={[]} onChange={vi.fn()} />);

    expect(screen.getByText(/no times available on this day/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('marks the chosen time as selected', () => {
    render(
      <SlotPicker
        slots={[slot('10:00', 'a'), slot('11:00', 'b')]}
        value="b"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: '11:00 AM' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '10:00 AM' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('DateStrip', () => {
  it('offers a run of days starting from the selection', () => {
    render(<DateStrip value="2026-08-21" onChange={vi.fn()} timezone="Asia/Kolkata" daysToShow={3} />);

    const days = screen.getAllByRole('radio');
    expect(days).toHaveLength(3);
    // Spelled out for screen readers rather than left as three visual
    // fragments. Matched loosely because the order of day and month is the
    // viewer's locale to decide, not ours.
    expect(days[0]).toHaveAccessibleName(/August 21|21 August/);
    expect(days[2]).toHaveAccessibleName(/August 23|23 August/);
  });

  it('moves between days with the arrow keys', async () => {
    const onChange = vi.fn();
    render(<DateStrip value="2026-08-21" onChange={onChange} timezone="Asia/Kolkata" />);

    const selected = screen.getByRole('radio', { checked: true });
    selected.focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith('2026-08-22');
  });

  it('keeps the strip to a single tab stop', () => {
    // A roving tabindex: fourteen days must not cost fourteen presses of Tab.
    render(<DateStrip value="2026-08-21" onChange={vi.fn()} timezone="Asia/Kolkata" daysToShow={5} />);
    const tabbable = screen.getAllByRole('radio').filter((el) => el.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
  });

  it('will not page back past the shop’s today', () => {
    // The strip is anchored on a future date, so "earlier" is available; on
    // today itself it must be disabled rather than offering the past.
    render(<DateStrip value="2026-08-21" onChange={vi.fn()} timezone="Asia/Kolkata" />);
    expect(screen.getByRole('button', { name: /earlier dates/i })).toBeEnabled();
  });
});
