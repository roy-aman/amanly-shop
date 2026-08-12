import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from './cn';

/**
 * Wires an <img> up to the `.rc-img` fade-in (see index.css): the image is held
 * at opacity 0 until it has decoded, then fades and settles into place.
 *
 * Spread onto the element — `<img className="rc-img" {...revealOnLoad} />`.
 *
 * Both halves are load-bearing. `onLoad` covers the normal path, and the `ref`
 * covers the cache race: an image already in the browser cache can finish
 * decoding before React attaches its handler, in which case `load` never fires
 * for us and the tile would stay invisible forever. `complete` is the only way
 * to detect that, and it is already true by the time the ref runs.
 *
 * Deliberately attribute-based rather than React state — no re-render per
 * image, and a grid of forty tiles costs forty attribute writes instead of
 * forty commits. The flag is never reset when `src` changes: swapping a gallery
 * image should cross to the new one, not blink through transparent first.
 */
export const revealOnLoad = {
  ref: (el: HTMLImageElement | null) => {
    if (el?.complete) el.dataset.loaded = 'true';
  },
  onLoad: (e: { currentTarget: HTMLImageElement }) => {
    e.currentTarget.dataset.loaded = 'true';
  },
} as const;

/**
 * ImageWithFallback — <img> that swaps to a graceful placeholder when `src` is
 * missing or fails to load (broken URL, network error). Keeps layout stable via
 * the wrapper's aspect/size classes. Defaults to `loading="lazy"`.
 */
export function ImageWithFallback({
  src,
  alt,
  className,
  wrapperClassName,
  fallback,
  loading = 'lazy',
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & { wrapperClassName?: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false);

  // Reset the error state when the source changes so a new URL gets a fresh try.
  useEffect(() => setFailed(false), [src]);

  const showFallback = !src || failed;

  return (
    <div className={cn('relative overflow-hidden bg-ink-850', wrapperClassName)}>
      {showFallback ? (
        <div className="flex h-full w-full items-center justify-center text-slate-600">
          {fallback ?? <ImageOff className="h-1/4 max-h-10 w-1/4 max-w-10" />}
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={loading}
          onError={() => setFailed(true)}
          className={cn('rc-img h-full w-full object-cover', className)}
          {...rest}
          // Composed, never overridden. `rest` cannot be allowed to replace
          // this: `.rc-img` holds the element at opacity 0 until `data-loaded`
          // is set, so a caller passing its own `onLoad` would not merely skip
          // the fade — it would leave the image permanently invisible.
          ref={revealOnLoad.ref}
          onLoad={(e) => {
            revealOnLoad.onLoad(e);
            rest.onLoad?.(e);
          }}
        />
      )}
    </div>
  );
}
