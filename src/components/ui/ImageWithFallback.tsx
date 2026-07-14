import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from './cn';

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
          className={cn('h-full w-full object-cover', className)}
          {...rest}
        />
      )}
    </div>
  );
}
