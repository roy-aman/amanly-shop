import { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { addDaysISO, formatISODateLabel, zonedToday } from '@/lib/format';
import { cn } from './cn';

/**
 * DateStrip — pick a day for an appointment.
 *
 * A horizontal run of days rather than a month grid, for a reason that is about
 * the API rather than taste: how far ahead a shop accepts bookings is not
 * published anywhere the storefront can read, so a calendar could not grey out
 * the days beyond it. A strip that pages forward makes no promise about a date
 * until the slots for it come back, and "no times available" carries the answer.
 *
 * It deliberately shows no availability of its own. Marking days free or full
 * would mean asking the server for every visible date on every render, and any
 * answer it cached would be stale by the time someone picked it.
 *
 * Days come from the SHOP's calendar, not the browser's: `zonedToday` is what
 * stops an evening customer in another zone being offered a "today" that ended
 * hours ago.
 */
export function DateStrip({
  value,
  onChange,
  timezone,
  daysToShow = 7,
  className,
}: {
  /** Selected day as YYYY-MM-DD in the store's zone. */
  value: string;
  onChange: (date: string) => void;
  timezone: string;
  /** How many days are visible at once; paging moves by this much. */
  daysToShow?: number;
  className?: string;
}) {
  const today = useMemo(() => zonedToday(timezone), [timezone]);

  // The strip starts at the selected day and runs forward. Anchoring on the
  // selection rather than on today is what makes paging work: the window a
  // customer scrolled to stays put when they pick something in it.
  const windowStart = value < today ? today : value;
  const days = useMemo(
    () => Array.from({ length: daysToShow }, (_, i) => addDaysISO(windowStart, i)),
    [windowStart, daysToShow],
  );

  const listRef = useRef<HTMLDivElement>(null);

  // Keyboard: arrows move between days the way a radio group does, so the whole
  // strip is one tab stop rather than a fortnight of them.
  const focusDay = (date: string) => {
    onChange(date);
    // The button for the new day may not exist yet if the window moved; the
    // effect below picks it up once it does.
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus();
    });
  };

  useEffect(() => {
    // Keep the selected day in view when paging changes the window. Called
    // optionally: jsdom does not implement scrollIntoView at all, and it is a
    // nicety rather than something the picker depends on.
    listRef.current
      ?.querySelector<HTMLElement>(`[data-date="${value}"]`)
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  const canGoBack = windowStart > today;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={() => onChange(addDaysISO(windowStart, -daysToShow) < today ? today : addDaysISO(windowStart, -daysToShow))}
        disabled={!canGoBack}
        aria-label="Show earlier dates"
        className="shrink-0 rounded-full border border-ink-600 p-2 text-slate-300 transition hover:border-slate-100 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>

      <div
        ref={listRef}
        role="radiogroup"
        aria-label="Choose a date"
        className="flex flex-1 gap-2 overflow-x-auto scroll-smooth pb-1"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            focusDay(addDaysISO(value, 1));
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prev = addDaysISO(value, -1);
            if (prev >= today) focusDay(prev);
          }
        }}
      >
        {days.map((date) => {
          const selected = date === value;
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              role="radio"
              aria-checked={selected}
              // Only the selected day is tabbable — a roving tabindex, so the
              // strip costs one stop instead of one per day.
              tabIndex={selected ? 0 : -1}
              data-date={date}
              onClick={() => onChange(date)}
              // Spelled out for a screen reader: "Fri 21 Aug" read aloud as
              // three fragments is not a date.
              aria-label={formatISODateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}
              className={cn(
                'flex min-w-[4.25rem] shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 transition duration-200 ease-emphasized active:scale-95',
                selected
                  ? 'border-primary bg-primary text-primary-fg shadow-sm'
                  : 'border-ink-600 bg-ink-850 text-slate-300 hover:border-slate-100 hover:bg-ink-800 hover:text-slate-100',
              )}
            >
              <span className="text-caption uppercase tracking-wide opacity-80">
                {isToday ? 'Today' : formatISODateLabel(date, { weekday: 'short', day: undefined, month: undefined })}
              </span>
              <span className="text-body-sm font-semibold">
                {formatISODateLabel(date, { weekday: undefined, day: 'numeric', month: undefined })}
              </span>
              <span className="text-caption opacity-70">
                {formatISODateLabel(date, { weekday: undefined, day: undefined, month: 'short' })}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange(addDaysISO(windowStart, daysToShow))}
        aria-label="Show later dates"
        className="shrink-0 rounded-full border border-ink-600 p-2 text-slate-300 transition hover:border-slate-100 hover:text-slate-100"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
