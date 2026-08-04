import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';

/**
 * FilterChip — compact toggle/removable chip for active filters and quick
 * facets. Two modes:
 *  - toggle: pass `selected` + `onClick` (acts as a pressable filter pill).
 *  - removable: pass `onRemove` to show a trailing ✕ (e.g. active-filter list).
 */
export function FilterChip({
  children,
  selected = false,
  onClick,
  onRemove,
  className,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition';
  const tone = selected
    ? 'border-primary bg-primary text-primary-fg'
    : 'border-ink-600 bg-ink-850 text-slate-300 hover:border-ink-500 hover:text-slate-100';

  return (
    <span className={cn(base, tone, className)}>
      {onClick ? (
        <button type="button" onClick={onClick} aria-pressed={selected} className="rounded focus:outline-none">
          {children}
        </button>
      ) : (
        <span>{children}</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove filter"
          className="-mr-1 rounded-full p-0.5 opacity-70 transition hover:bg-black/20 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}
