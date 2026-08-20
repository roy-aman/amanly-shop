import { formatWallClock, wallClockToMinutes, weekdayName } from '@/lib/format';
import type { BusinessHoursEntry } from '@/lib/types';
import { Input, Switch, cn } from '@/components/ui';

/** Monday first, ISO order — the same numbering the server uses. */
const WEEK = [1, 2, 3, 4, 5, 6, 7];

const DEFAULT_OPEN = '09:00';
const DEFAULT_CLOSE = '17:00';

/** The window the track spans. Not a full 24 hours: almost nobody opens at 3am,
 *  and stretching the bar across empty night hours makes every shop's week look
 *  like a thin sliver. */
const TRACK_FROM = 6 * 60;
const TRACK_TO = 24 * 60;

/**
 * The week, as seven rows with a bar each.
 *
 * The bar is the point. Seven pairs of time inputs are accurate but unreadable —
 * you cannot see that Saturday is short, or that Thursday was left an hour
 * behind the rest, without reading fourteen numbers and doing the arithmetic. A
 * track shows the shape of the week the way a diary does, and the inputs stay
 * for setting it exactly.
 *
 * Closed is the absence of a row rather than a flag on one — that is how the API
 * models it, and modelling it the same way here means a day switched off cannot
 * accidentally travel as "open from nothing to nothing". Unchecking a day drops
 * its entry entirely; switching it back adds one with usable hours rather than
 * two empty boxes.
 */
export function BusinessHoursEditor({
  value,
  onChange,
}: {
  value: BusinessHoursEntry[];
  onChange: (next: BusinessHoursEntry[]) => void;
}) {
  const byDay = new Map(value.map((entry) => [entry.weekday, entry]));

  const write = (next: Map<number, BusinessHoursEntry>) => {
    // Always weekday-sorted: the server accepts any order, but a stable one
    // keeps saved payloads comparable and the UI predictable.
    onChange([...next.values()].sort((a, b) => a.weekday - b.weekday));
  };

  const toggle = (weekday: number, open: boolean) => {
    const next = new Map(byDay);
    if (open) {
      // Copy the week's existing rhythm rather than assuming nine to five: a
      // shop that works 11–8 should not have to retype it seven times.
      const template = value[0];
      next.set(weekday, {
        weekday,
        openTime: template?.openTime ?? DEFAULT_OPEN,
        closeTime: template?.closeTime ?? DEFAULT_CLOSE,
      });
    } else {
      next.delete(weekday);
    }
    write(next);
  };

  const setTime = (weekday: number, field: 'openTime' | 'closeTime', time: string) => {
    const entry = byDay.get(weekday);
    if (!entry) return;
    const next = new Map(byDay);
    next.set(weekday, { ...entry, [field]: time });
    write(next);
  };

  /** Copies one day's hours to every day that is currently open. The single most
   *  repetitive thing about this form. */
  const applyToAll = (from: BusinessHoursEntry) => {
    const next = new Map(byDay);
    for (const [weekday, entry] of next) {
      next.set(weekday, { ...entry, openTime: from.openTime, closeTime: from.closeTime });
    }
    write(next);
  };

  const span = TRACK_TO - TRACK_FROM;
  const openDays = value.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption text-slate-500">
          {openDays === 0
            ? 'Closed all week'
            : `Open ${openDays} ${openDays === 1 ? 'day' : 'days'} a week`}
        </p>
        {/* The hour ruler, aligned with the bars below. */}
        <div className="hidden flex-1 justify-end gap-6 pr-1 text-caption tabular-nums text-slate-600 sm:flex">
          {[8, 12, 16, 20].map((h) => (
            <span key={h}>{formatWallClock(`${String(h).padStart(2, '0')}:00`)}</span>
          ))}
        </div>
      </div>

      {WEEK.map((weekday) => {
        const entry = byDay.get(weekday);
        const dayName = weekdayName(weekday);
        const open = entry != null;
        const openMin = entry ? wallClockToMinutes(entry.openTime) : 0;
        const closeMin = entry ? wallClockToMinutes(entry.closeTime) : 0;
        const invalid = open && closeMin <= openMin;

        return (
          <div
            key={weekday}
            className={cn(
              'rounded-xl border px-4 py-3 transition',
              open ? 'border-ink-700 bg-ink-900/60' : 'border-ink-800 bg-ink-900/20',
            )}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="flex w-40 shrink-0 items-center gap-3">
                <Switch
                  checked={open}
                  onChange={(next) => toggle(weekday, next)}
                  label={`Open on ${dayName}`}
                  size="sm"
                />
                <span className={cn('text-body-sm font-medium', open ? 'text-slate-200' : 'text-slate-500')}>
                  {dayName}
                </span>
              </div>

              {open ? (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      aria-label={`${dayName} opening time`}
                      value={entry.openTime}
                      onChange={(e) => setTime(weekday, 'openTime', e.target.value)}
                      className="w-[7.5rem]"
                    />
                    <span className="text-slate-500">to</span>
                    <Input
                      type="time"
                      aria-label={`${dayName} closing time`}
                      value={entry.closeTime}
                      invalid={invalid}
                      onChange={(e) => setTime(weekday, 'closeTime', e.target.value)}
                      className="w-[7.5rem]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => applyToAll(entry)}
                    className="rounded text-caption text-slate-500 underline-offset-2 transition hover:text-slate-300 hover:underline"
                  >
                    Copy to all open days
                  </button>
                </>
              ) : (
                <span className="text-body-sm text-slate-500">Closed</span>
              )}
            </div>

            {/* The bar. Hidden on narrow screens, where it would be too short to
                say anything the numbers do not. */}
            <div className="mt-2.5 hidden h-2 overflow-hidden rounded-full bg-ink-800 sm:block" aria-hidden>
              {open && !invalid && (
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{
                    marginLeft: `${(Math.max(openMin - TRACK_FROM, 0) / span) * 100}%`,
                    width: `${(Math.max(closeMin - Math.max(openMin, TRACK_FROM), 0) / span) * 100}%`,
                  }}
                />
              )}
            </div>

            {invalid && (
              <p className="mt-1.5 text-caption text-danger-300">Closing time has to be after opening time.</p>
            )}
          </div>
        );
      })}

      {value.length === 0 && (
        // Worth saying plainly: an empty week is a valid save that shuts the
        // shop, and a merchant who does it by accident sees "no times available"
        // on every service with nothing to explain it.
        <p className="rounded-lg border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-caption text-warning-300">
          Every day is closed, so nobody can book anything.
        </p>
      )}
    </div>
  );
}
