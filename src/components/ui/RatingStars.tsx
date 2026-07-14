import { Star } from 'lucide-react';
import { cn } from './cn';

/**
 * RatingStars — display-only star rating (0–5, supports halves via a clipped
 * overlay). Interactive input arrives with reviews in WP-3.2. `count` renders a
 * "(N)" suffix when provided. Accessible via `role="img"` + aria-label.
 */
export function RatingStars({
  value,
  max = 5,
  size = 'md',
  count,
  className,
}: {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  count?: number;
  className?: string;
}) {
  const dim = size === 'lg' ? 'h-5 w-5' : size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const clamped = Math.max(0, Math.min(max, value));
  const label = `Rated ${clamped.toFixed(1)} out of ${max}${count != null ? ` (${count} reviews)` : ''}`;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="relative inline-flex" role="img" aria-label={label}>
        {/* Empty track */}
        <span className="inline-flex text-ink-600">
          {Array.from({ length: max }).map((_, i) => (
            <Star key={i} className={cn(dim, 'fill-current')} />
          ))}
        </span>
        {/* Filled overlay, clipped to the rating fraction */}
        <span
          className="absolute inset-0 inline-flex overflow-hidden text-gold-400"
          style={{ width: `${(clamped / max) * 100}%` }}
          aria-hidden
        >
          {Array.from({ length: max }).map((_, i) => (
            <Star key={i} className={cn(dim, 'shrink-0 fill-current')} />
          ))}
        </span>
      </span>
      {count != null && <span className="text-xs text-slate-500">({count})</span>}
    </span>
  );
}
