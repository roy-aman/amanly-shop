import { weekdayName } from '@/lib/format';
import type { BusinessHoursEntry } from '@/lib/types';
import { Input } from '@/components/ui';

/** Monday first, ISO order — the same numbering the server uses. */
const WEEK = [1, 2, 3, 4, 5, 6, 7];

const DEFAULT_OPEN = '09:00';
const DEFAULT_CLOSE = '17:00';

/**
 * The week, as seven rows.
 *
 * Closed is the absence of a row rather than a flag on one — that is how the API
 * models it, and modelling it the same way here means a day switched off cannot
 * accidentally travel as "open from nothing to nothing". Unchecking a day drops
 * its entry entirely; checking it back adds one with sensible hours rather than
 * two empty boxes.
 *
 * Seven rows are always rendered even though only some become entries, because
 * a merchant setting up needs to see the days they have not done yet.
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
    if (open) next.set(weekday, { weekday, openTime: DEFAULT_OPEN, closeTime: DEFAULT_CLOSE });
    else next.delete(weekday);
    write(next);
  };

  const setTime = (weekday: number, field: 'openTime' | 'closeTime', time: string) => {
    const entry = byDay.get(weekday);
    if (!entry) return;
    const next = new Map(byDay);
    next.set(weekday, { ...entry, [field]: time });
    write(next);
  };

  return (
    <div className="space-y-2">
      {WEEK.map((weekday) => {
        const entry = byDay.get(weekday);
        const dayName = weekdayName(weekday);
        const invalid = entry != null && entry.closeTime <= entry.openTime;

        return (
          <div key={weekday} className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-700 px-3 py-2.5">
            <label className="flex w-36 shrink-0 items-center gap-2 text-body-sm text-slate-200">
              <input
                type="checkbox"
                checked={entry != null}
                onChange={(e) => toggle(weekday, e.target.checked)}
                aria-label={`Open on ${dayName}`}
                className="h-4 w-4 rounded border-ink-600"
              />
              {dayName}
            </label>

            {entry ? (
              <div className="flex flex-wrap items-center gap-2">
                {/* Field renders labels without htmlFor, so these name themselves. */}
                <Input
                  type="time"
                  aria-label={`${dayName} opening time`}
                  value={entry.openTime}
                  onChange={(e) => setTime(weekday, 'openTime', e.target.value)}
                  className="w-32"
                />
                <span className="text-slate-500">to</span>
                <Input
                  type="time"
                  aria-label={`${dayName} closing time`}
                  value={entry.closeTime}
                  invalid={invalid}
                  onChange={(e) => setTime(weekday, 'closeTime', e.target.value)}
                  className="w-32"
                />
                {invalid && (
                  <span className="text-caption text-danger-300">Closing has to be after opening</span>
                )}
              </div>
            ) : (
              <span className="text-body-sm text-slate-500">Closed</span>
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
