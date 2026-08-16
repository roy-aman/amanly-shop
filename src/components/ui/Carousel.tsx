import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
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
  autoPlayMs,
  rounded = true,
}: {
  children: ReactNode;
  loop?: boolean;
  showDots?: boolean;
  showArrows?: boolean;
  className?: string;
  ariaLabel?: string;
  /**
   * Advance on a timer. Opt-in, and deliberately not the default: a product
   * gallery that moved on its own while somebody was studying a photograph
   * would be a defect. Only a promotional slot wants this.
   */
  autoPlayMs?: number;
  /** Off for a full-bleed slot, where a rounded corner against the page edge reads as a mistake. */
  rounded?: boolean;
}) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

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

  /**
   * Advances on a timer, and stops the moment it would be rude to keep moving.
   *
   * <p>Paused while the pointer is over it or focus is inside it — a slide that
   * changes as somebody reaches for its link makes them click the wrong thing.
   * Honoured `prefers-reduced-motion` too: for a vestibular disorder an
   * unsolicited moving banner is not decoration, and the slot still works as a
   * carousel that waits to be driven.
   */
  useEffect(() => {
    if (!autoPlayMs || count < 2 || paused) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), autoPlayMs);
    return () => window.clearInterval(timer);
  }, [autoPlayMs, count, paused]);

  // A background tab keeps firing intervals, so a shopper returning after ten
  // minutes would otherwise find the banner mid-gallop through hundreds of slides.
  useEffect(() => {
    if (!autoPlayMs) return;
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [autoPlayMs]);

  if (count === 0) return null;

  const atStart = !loop && index === 0;
  const atEnd = !loop && index === count - 1;

  return (
    <div
      ref={frame}
      className={cn('relative', className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={autoPlayMs ? () => setPaused(true) : undefined}
      onMouseLeave={autoPlayMs ? () => setPaused(false) : undefined}
      onFocusCapture={autoPlayMs ? () => setPaused(true) : undefined}
      onBlurCapture={
        autoPlayMs
          ? (e) => setPaused(frame.current?.contains(e.relatedTarget as Node) ?? false)
          : undefined
      }
    >
      <div className={cn('overflow-hidden', rounded && 'rounded-2xl')}>
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
