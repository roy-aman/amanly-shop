import { cn } from '@/components/ui';
import { RANGE_PRESETS, type RangePreset } from '@/lib/dateRange';

/**
 * Segmented preset control driving the admin stats date range (7 / 30 / 90 days).
 * Value is the trailing-window length in days; the page converts it to from/to via
 * `trailingRange`. Each option is a real `<button>` — keyboard-operable with the
 * standard gold focus ring.
 */
export default function DateRangeControl({
  value,
  onChange,
  presets = RANGE_PRESETS,
  className,
}: {
  value: number;
  onChange: (days: number) => void;
  presets?: RangePreset[];
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Date range"
      className={cn('inline-flex rounded-xl border border-ink-700 bg-ink-900/60 p-1', className)}
    >
      {presets.map((p) => {
        const active = p.days === value;
        return (
          <button
            key={p.days}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(p.days)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition',
              active ? 'bg-gold-400/15 text-gold-200' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
