import { Children, useCallback, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';

/**
 * Carousel — one-slide-per-view horizontal carousel with prev/next controls,
 * dot pagination and arrow-key navigation. Each child is a slide. `loop` wraps
 * at the ends. For product-image galleries or homepage rails.
 */
export function Carousel({
  children,
  loop = false,
  showDots = true,
  showArrows = true,
  className,
  ariaLabel = 'Carousel',
}: {
  children: ReactNode;
  loop?: boolean;
  showDots?: boolean;
  showArrows?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const [index, setIndex] = useState(0);

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      if (loop) setIndex(((next % count) + count) % count);
      else setIndex(Math.max(0, Math.min(count - 1, next)));
    },
    [count, loop],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    }
  };

  if (count === 0) return null;

  const atStart = !loop && index === 0;
  const atEnd = !loop && index === count - 1;

  return (
    <div
      className={cn('relative', className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-300 ease-emphasized"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              className="w-full shrink-0 grow-0 basis-full"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== index}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {showArrows && count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={atStart}
            aria-label="Previous slide"
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-ink-600 bg-ink-900/80 text-slate-200 backdrop-blur transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={atEnd}
            aria-label="Next slide"
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-ink-600 bg-ink-900/80 text-slate-200 backdrop-blur transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {showDots && count > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={cn(
                'h-2 rounded-full transition-all',
                i === index ? 'w-5 bg-gold-400' : 'w-2 bg-ink-600 hover:bg-ink-500',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
