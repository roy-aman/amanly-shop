import { cn } from './cn';

const SIZES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-h2',
} as const;

/**
 * The Amanly wordmark: the name set in the display face, letter-spaced.
 *
 * Half of the lockup — pair it with {@link AmanlyMark} where the brand sheet
 * shows the monogram (header, footer, auth chrome) and use it alone in tight or
 * repeated contexts, where a second mark on the page becomes noise.
 *
 * `name` defaults to the brand but accepts the store name from settings, so an
 * operator renaming the store in the admin console still drives the header.
 */
export function Wordmark({
  name = 'Amanly',
  size = 'md',
  className,
}: {
  name?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        // The negative right margin cancels the trailing letter-space that
        // tracking adds after the final glyph, so the mark optically centres.
        'font-display font-semibold uppercase leading-none tracking-[0.18em] text-slate-100 -mr-[0.18em]',
        SIZES[size],
        className,
      )}
    >
      {name}
    </span>
  );
}
