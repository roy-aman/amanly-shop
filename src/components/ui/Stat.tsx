import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from './cn';

export interface StatDelta {
  /** Signed change vs. the comparison period (e.g. 12.5 for +12.5%). */
  value: number;
  /** Rendered after the number; defaults to "%". */
  suffix?: string;
  /** When true (default), a positive delta is "good" (success/green). Set false
   *  for metrics where up is bad (refunds, cancellations). */
  positiveIsGood?: boolean;
  /** Small caption, e.g. "vs. last month". */
  label?: string;
}

/**
 * Stat — dashboard KPI tile: overline label, large value, optional icon chip
 * and an optional delta badge with a trend arrow. The WP-1.2 successor to the
 * legacy `admin/StatCard`; storefront + admin dashboards adopt it in Phase 2/3.
 */
export function Stat({
  label,
  value,
  icon,
  delta,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  delta?: StatDelta;
  hint?: string;
  className?: string;
}) {
  const good = delta ? (delta.value >= 0) === (delta.positiveIsGood ?? true) : false;
  const up = delta ? delta.value >= 0 : false;

  return (
    <div className={cn('rc-card flex items-start gap-4 p-5', className)}>
      {icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold-400/20 bg-gold-400/10 text-gold-300">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-overline uppercase text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-100">{value}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {delta && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-semibold',
                good ? 'text-success-400' : 'text-danger-400',
              )}
            >
              {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {delta.value > 0 ? '+' : ''}
              {delta.value}
              {delta.suffix ?? '%'}
            </span>
          )}
          {(delta?.label || hint) && <span className="text-xs text-slate-500">{delta?.label ?? hint}</span>}
        </div>
      </div>
    </div>
  );
}
