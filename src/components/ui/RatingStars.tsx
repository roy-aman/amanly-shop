import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from './cn';

const STAR_DIM = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' } as const;

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
  const dim = STAR_DIM[size];
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
          className="absolute inset-0 inline-flex overflow-hidden text-slate-100"
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

/**
 * RatingInput — interactive star rating (1–max) for the write-review flow. Built
 * on native radio inputs (one per star, visually hidden), so it is fully keyboard
 * operable (arrow keys move between stars, Space selects) and screen-reader
 * accessible for free, with a `radiogroup`/`radio` semantic tree. The gold focus
 * ring shows on the focused star via `peer-focus-visible`. Kept separate from the
 * display-only `RatingStars` so that component's surface is unchanged.
 */
export function RatingInput({
  value,
  onChange,
  max = 5,
  size = 'lg',
  name = 'rating',
  label = 'Your rating',
  disabled = false,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  name?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const dim = STAR_DIM[size];
  const shown = hover ?? value; // preview on hover/focus, else the committed value

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex items-center gap-1', disabled && 'opacity-50', className)}
      onMouseLeave={() => setHover(null)}
    >
      {Array.from({ length: max }).map((_, i) => {
        const star = i + 1;
        const filled = star <= shown;
        return (
          <label
            key={star}
            className={cn('inline-flex', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
            onMouseEnter={() => !disabled && setHover(star)}
          >
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              disabled={disabled}
              onChange={() => onChange(star)}
              onFocus={() => setHover(star)}
              onBlur={() => setHover(null)}
              className="peer sr-only"
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
            />
            <Star
              aria-hidden
              className={cn(
                dim,
                'rounded transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink-950',
                filled ? 'fill-slate-100 text-slate-100' : 'fill-transparent text-ink-500',
              )}
            />
          </label>
        );
      })}
    </div>
  );
}
