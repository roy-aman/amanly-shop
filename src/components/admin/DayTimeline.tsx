import { useMemo } from 'react';

import { formatWallClock, minutesInZone, wallClockToMinutes, zonedToday } from '@/lib/format';
import type { AdminBookingResponse, BookingStatus } from '@/lib/types';
import { cn } from '@/components/ui';

/**
 * One day of the diary, drawn against the clock.
 *
 * A list answers "what is booked"; this answers the question a front desk
 * actually has, which is "what does the day look like" — where the gaps are, how
 * close two appointments sit, whether the afternoon is full. That shape is only
 * visible when time is a distance rather than a column.
 *
 * Positioning uses the SHOP's clock, not the browser's. Otherwise a manager
 * checking the day from another country would see their own morning drawn
 * against their staff's afternoon.
 *
 * Overlaps are packed generically: an appointment goes in the first column where
 * it does not collide, and the row widens to fit however many end up side by
 * side. It deliberately does not read the shop's capacity setting to decide how
 * many columns there should be — that lives behind an admin-only endpoint, and
 * counter staff use this screen.
 */

const HOUR_HEIGHT = 64; // px per hour — an hour tall enough to place 15-minute work in.

const STATUS_STYLE: Record<BookingStatus, string> = {
  CONFIRMED: 'border-success-500/40 bg-success-500/10',
  COMPLETED: 'border-info-500/40 bg-info-500/10',
  CANCELLED: 'border-danger-500/40 bg-danger-500/10 opacity-60',
  NO_SHOW: 'border-warning-500/40 bg-warning-500/10',
};

interface Placed {
  booking: AdminBookingResponse;
  startMin: number;
  endMin: number;
  column: number;
  columns: number;
}

/** First-fit column packing over a set of intervals. */
function pack(bookings: AdminBookingResponse[], timezone: string): Placed[] {
  const items = bookings
    .map((booking) => ({
      booking,
      startMin: minutesInZone(booking.startsAt, timezone),
      endMin: minutesInZone(booking.endsAt, timezone),
    }))
    // An appointment running past midnight reads as ending at 00:xx, which would
    // draw a block of negative height; clamp it to the end of the day instead.
    .map((i) => ({ ...i, endMin: i.endMin <= i.startMin ? 24 * 60 : i.endMin }))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const columnEnds: number[] = [];
  const placed: Omit<Placed, 'columns'>[] = [];

  for (const item of items) {
    let column = columnEnds.findIndex((end) => end <= item.startMin);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.endMin);
    } else {
      columnEnds[column] = item.endMin;
    }
    placed.push({ ...item, column });
  }

  // Every block in a day shares the same column count, which keeps the grid
  // readable — a lane that appears and disappears down the page is harder to
  // scan than one that is simply narrow.
  const columns = Math.max(columnEnds.length, 1);
  return placed.map((p) => ({ ...p, columns }));
}

export function DayTimeline({
  bookings,
  timezone,
  date,
  hours,
  onSelect,
}: {
  bookings: AdminBookingResponse[];
  timezone: string;
  /** The day being shown, as YYYY-MM-DD in the shop's zone. */
  date: string;
  /** That weekday's opening hours, when the shop has any. */
  hours?: { openTime: string; closeTime: string } | null;
  onSelect: (booking: AdminBookingResponse) => void;
}) {
  const placed = useMemo(() => pack(bookings, timezone), [bookings, timezone]);

  // The window to draw: opening hours with an hour's margin, widened if anything
  // is booked outside them — a walk-in taken after closing must still appear.
  const { fromHour, toHour } = useMemo(() => {
    let start = hours ? Math.floor(wallClockToMinutes(hours.openTime) / 60) - 1 : 8;
    let end = hours ? Math.ceil(wallClockToMinutes(hours.closeTime) / 60) + 1 : 21;
    for (const p of placed) {
      start = Math.min(start, Math.floor(p.startMin / 60));
      end = Math.max(end, Math.ceil(p.endMin / 60));
    }
    return { fromHour: Math.max(0, start), toHour: Math.min(24, Math.max(end, start + 4)) };
  }, [hours, placed]);

  const totalMinutes = (toHour - fromHour) * 60;
  const nowMin = date === zonedToday(timezone) ? minutesInZone(new Date().toISOString(), timezone) : null;
  const nowVisible = nowMin != null && nowMin >= fromHour * 60 && nowMin <= toHour * 60;

  const offsetOf = (minutes: number) => ((minutes - fromHour * 60) / totalMinutes) * 100;

  return (
    <div className="flex gap-3">
      {/* Hour ruler */}
      <div className="w-14 shrink-0" style={{ height: (toHour - fromHour) * HOUR_HEIGHT }}>
        {Array.from({ length: toHour - fromHour }, (_, i) => (
          <div key={i} className="relative" style={{ height: HOUR_HEIGHT }}>
            <span className="absolute -top-2 right-0 text-caption tabular-nums text-slate-500">
              {formatWallClock(`${String(fromHour + i).padStart(2, '0')}:00`)}
            </span>
          </div>
        ))}
      </div>

      <div
        className="relative flex-1 rounded-xl border border-ink-700 bg-ink-900/40"
        style={{ height: (toHour - fromHour) * HOUR_HEIGHT }}
      >
        {/* Hour lines */}
        {Array.from({ length: toHour - fromHour }, (_, i) => (
          <div
            key={i}
            className="absolute inset-x-0 border-t border-ink-800"
            style={{ top: i * HOUR_HEIGHT }}
            aria-hidden
          />
        ))}

        {/* Now, when the day being viewed is today in the shop's zone. */}
        {nowVisible && (
          <div className="absolute inset-x-0 z-10 flex items-center" style={{ top: `${offsetOf(nowMin!)}%` }}>
            <span className="h-1.5 w-1.5 rounded-full bg-danger-500" />
            <span className="h-px flex-1 bg-danger-500/60" />
          </div>
        )}

        {placed.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-body-sm text-slate-500">
            Nothing booked for this day.
          </p>
        )}

        {placed.map(({ booking, startMin, endMin, column, columns }) => (
          <button
            key={booking.id}
            type="button"
            onClick={() => onSelect(booking)}
            className={cn(
              'absolute overflow-hidden rounded-lg border px-2 py-1.5 text-left transition hover:brightness-125',
              STATUS_STYLE[booking.status],
            )}
            style={{
              top: `${offsetOf(startMin)}%`,
              height: `${((endMin - startMin) / totalMinutes) * 100}%`,
              left: `calc(${(column / columns) * 100}% + 4px)`,
              width: `calc(${(1 / columns) * 100}% - 8px)`,
            }}
          >
            <span className="block truncate text-caption tabular-nums text-slate-300">
              {formatWallClock(
                `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`,
              )}
            </span>
            <span className="block truncate text-body-sm font-medium text-slate-100">
              {booking.customerName}
            </span>
            <span className="block truncate text-caption text-slate-400">
              {booking.serviceName}
              {booking.staffName ? ` · ${booking.staffName}` : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
