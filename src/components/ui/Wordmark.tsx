import { cn } from './cn';

const SIZES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-h2',
} as const;

/**
 * The Amanly brand mark: type, no icon.
 *
 * Deliberately icon-free. A pictorial mark beside the name is the default move
 * of template storefronts; the brands Amanly is positioned against (COS, Zara,
 * Uniqlo) all sign with a wordmark alone, and it is what makes the header read
 * as a label rather than as an app.
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
