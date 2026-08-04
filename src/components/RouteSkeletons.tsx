/* ===================================================================
   Route-level loading skeletons (WP-1.4)

   Page-shaped placeholders composed from the WP-1.2 `Skeleton*` primitives.
   Used in two places:
     1. As <Suspense> fallbacks for lazy-loaded routes (see App.tsx), matched
        to the page type (list / detail / form / analytics).
     2. As the in-page data-loading branch on primary pages (replacing the old
        bare <Spinner>/<PageLoader>).

   Keep these presentational and dependency-free beyond the UI kit. They must
   never fetch data or read context. Phase 2 pages can reuse these shapes.
   =================================================================== */
import { Skeleton, SkeletonCard, SkeletonTable } from '@/components/ui';

/** Title bar + subtitle, mirroring `PageHeader`. */
export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {action && <Skeleton className="h-10 w-32 rounded-lg" />}
    </div>
  );
}

/** A grid of product-card placeholders (storefront catalog / rails). */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  // Mirrors the real card: a 4:5 image tile with two text lines under it, and no
  // card chrome. A skeleton that doesn't match its content causes a visible jump
  // when the data lands.
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[4/5] w-full rounded-none" />
          <Skeleton className="mt-3 h-3.5 w-3/4" />
          <Skeleton className="mt-2 h-3.5 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** Stacked row bars for list surfaces without a tabular header. */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

/** Full-page storefront listing: header + filter bar + product grid. */
export function StoreListSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <ProductGridSkeleton />
    </div>
  );
}

/** Product detail: breadcrumb + gallery beside a stack of detail lines. */
export function ProductDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        <Skeleton className="aspect-[4/5] w-full rounded-none" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-11 w-44 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Generic full-page list: header + a card holding stacked rows. */
export function ListSkeleton({ action = false, rows = 6 }: { action?: boolean; rows?: number }) {
  return (
    <div>
      <PageHeaderSkeleton action={action} />
      <div className="rc-card p-4">
        <RowsSkeleton rows={rows} />
      </div>
    </div>
  );
}

/** Full-page master/detail: header + two-column panels. */
export function DetailSkeleton() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** Full-page form: header + a card of labelled field placeholders. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="rc-card space-y-5 p-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-11 w-40 rounded-lg" />
      </div>
    </div>
  );
}

/** Analytics dashboard: KPI tiles + chart panels. */
export function DashboardSkeleton() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Skeleton className="h-72 w-full rounded-2xl xl:col-span-2" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/** Centered card placeholder for the standalone auth screens. */
export function AuthFormSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-ink-700/70 bg-ink-900/70 p-8 shadow-card">
        <div className="space-y-2">
          <Skeleton className="mx-auto h-7 w-40" />
          <Skeleton className="mx-auto h-4 w-56" />
        </div>
        <div className="space-y-4 pt-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Re-export the tabular skeleton so pages that keep their own header/filters and
// only swap the table body can import everything loading-related from one place.
export { SkeletonTable };
