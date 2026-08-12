import { cn } from './cn';

/**
 * The Amanly "A" monogram.
 *
 * Two shapes, not one: the chevron carries `currentColor` so it inherits from
 * whatever it sits in (black on the storefront, near-white in the console), and
 * the slash is pinned to the brand gold. That split is what lets a single mark
 * work on light, dark and gold grounds without a per-context asset — the same
 * arrangement the brand sheet shows across its icon variations.
 *
 * Pair it with {@link Wordmark} for the full lockup; use it alone where the
 * name is already present or space is tight (favicon, app icon, tight headers).
 */
export function AmanlyMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('h-6 w-6', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {/* Apex is cut flat rather than pointed: at favicon sizes a true point
          disappears into a pixel and the mark reads as a smudge. */}
      <path d="M2 58 L30 4 H34 L62 58 H48 L32 27 L16 58 Z" className="fill-current" />
      <path d="M28 37 H35 L43 52 H36 Z" className="fill-brand" />
    </svg>
  );
}
