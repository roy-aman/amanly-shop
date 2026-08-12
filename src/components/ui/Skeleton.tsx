import { cn } from './cn';

/**
 * Skeleton — animated placeholder block. Compose freely, or use the pre-built
 * `SkeletonText` / `SkeletonCard` / `SkeletonTable` / `SkeletonDetail` variants
 * for common loading layouts. Themed through surface tokens, so it reads on
 * both the light storefront and the dark console.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rc-shimmer rounded-lg bg-ink-850', className)} aria-hidden />;
}

/** N lines of shimmering text; the last line is shortened for a natural look. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Card placeholder: image band + title + two text lines. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rc-card overflow-hidden p-4', className)} aria-hidden>
      <Skeleton className="mb-4 aspect-[4/3] w-full rounded-xl" />
      <Skeleton className="mb-2 h-4 w-3/4" />
      <SkeletonText lines={2} />
    </div>
  );
}

/** Table placeholder: header row + N body rows across `columns` cells. */
export function SkeletonTable({ rows = 5, columns = 4, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-ink-700/70', className)} aria-hidden>
      <div className="flex gap-4 border-b border-ink-700 bg-ink-900/60 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-ink-800 px-4 py-4 last:border-b-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={cn('h-3.5 flex-1', c === 0 && 'max-w-[40%]')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Detail placeholder: big media panel beside a stack of text lines. */
export function SkeletonDetail({ className }: { className?: string }) {
  return (
    <div className={cn('grid gap-8 md:grid-cols-2', className)} aria-hidden>
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-1/3" />
        <SkeletonText lines={4} />
        <Skeleton className="h-11 w-40 rounded-lg" />
      </div>
    </div>
  );
}
