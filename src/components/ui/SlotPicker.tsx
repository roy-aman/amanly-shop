import type { ReactNode } from 'react';
import { CalendarX2 } from 'lucide-react';

import { formatWallClock, wallClockToMinutes } from '@/lib/format';
import type { AvailabilitySlot } from '@/lib/types';
import { Skeleton } from './Skeleton';
import { cn } from './cn';

/**
 * SlotPicker — choose a start time from what the shop actually has free.
 *
 * The heart of booking, and the component with the most rules attached to it.
 *
 * It renders `localTime`, the label the server already worked out in the shop's
 * zone, and never formats the instant itself. That is what makes the picker
 * timezone-proof without a timezone library: a customer in London reading a
 * Mumbai shop's diary sees Mumbai's clock, because that is the clock they will
 * have to turn up on.
 *
 * `onChange` hands back the whole slot rather than its time, so the caller posts
 * `slot.startsAt` exactly as it arrived. The server refuses times it did not
 * offer, and an instant rebuilt from a formatted label is a different string
 * even when it is the same moment.
 *
 * An empty list is a NORMAL answer — closed that day, fully booked, a date in
 * the past, or beyond the shop's booking window. It renders as a quiet note with
 * a nudge to try another date, never as an error. Getting this wrong makes a
 * shop's closed Sunday look like an outage.
 */

/** Slots are grouped by part of day. Splitting at noon and 5pm matches how
 *  people describe when they want to come in ("some time this afternoon") and
 *  keeps a busy shop's forty slots readable as three short blocks. */
const DAYPARTS = [
  { key: 'morning', label: 'Morning', until: 12 * 60 },
  { key: 'afternoon', label: 'Afternoon', until: 17 * 60 },
  { key: 'evening', label: 'Evening', until: 24 * 60 },
] as const;

function group(slots: AvailabilitySlot[]) {
  return DAYPARTS.map((part, i) => {
    const from = i === 0 ? 0 : DAYPARTS[i - 1].until;
    return {
      ...part,
      slots: slots.filter((s) => {
        const mins = wallClockToMinutes(s.localTime);
        return mins >= from && mins < part.until;
      }),
    };
  }).filter((part) => part.slots.length > 0);
}

export function SlotPicker({
  slots,
  value,
  onChange,
  loading = false,
  emptyMessage,
  className,
}: {
  slots: AvailabilitySlot[];
  /** The selected slot's `startsAt`. */
  value?: string | null;
  onChange: (slot: AvailabilitySlot) => void;
  loading?: boolean;
  emptyMessage?: ReactNode;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={cn('space-y-4', className)} aria-busy="true" aria-label="Loading available times">
        {[0, 1].map((row) => (
          <div key={row} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-20 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      // Deliberately not an EmptyState with an error tone: nothing has gone
      // wrong. The shop is closed, full, or the date is outside its window, and
      // the only useful next move is another date.
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border border-dashed border-ink-600 bg-ink-850/60 px-4 py-5 text-body-sm text-slate-400',
          className,
        )}
      >
        <CalendarX2 className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        <p>{emptyMessage ?? 'No times available on this day. Try another date.'}</p>
      </div>
    );
  }

  const groups = group(slots);

  return (
    <div className={cn('space-y-4', className)}>
      {groups.map((part) => (
        <div key={part.key}>
          <h4 className="mb-2 text-overline uppercase tracking-wide text-slate-500">{part.label}</h4>
          <div role="radiogroup" aria-label={`${part.label} times`} className="flex flex-wrap gap-2">
            {part.slots.map((slot) => {
              const selected = slot.startsAt === value;
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(slot)}
                  className={cn(
                    'rounded-lg border px-3.5 py-2 text-body-sm font-medium tabular-nums transition duration-200 ease-emphasized active:scale-95',
                    selected
                      ? 'border-primary bg-primary text-primary-fg shadow-sm'
                      : 'border-ink-600 bg-ink-850 text-slate-200 hover:border-slate-100 hover:bg-ink-800',
                  )}
                >
                  {formatWallClock(slot.localTime)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
