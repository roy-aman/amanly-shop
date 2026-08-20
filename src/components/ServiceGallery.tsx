import { useState } from 'react';
import { ImageOff } from 'lucide-react';

import type { ServiceImageResponse } from '@/lib/types';
import { ImageWithFallback, cn } from '@/components/ui';

/**
 * A service's pictures.
 *
 * One large frame with thumbnails under it, rather than a swipe-only carousel:
 * somebody deciding whether to spend an hour and their money in a room wants to
 * see all of it at once and go back to the one that mattered. Arrows hide what
 * there is; thumbnails say how much there is.
 *
 * Falls back to the single `imageUrl` when the gallery is empty, which is what an
 * older backend — or a service nobody has added pictures to since — will send.
 */
export function ServiceGallery({
  images,
  fallbackUrl,
  fallbackAlt,
  name,
}: {
  images: ServiceImageResponse[];
  fallbackUrl: string | null;
  fallbackAlt: string | null;
  name: string;
}) {
  const gallery: ServiceImageResponse[] =
    images.length > 0
      ? images
      : fallbackUrl
        ? [{ id: 'primary', url: fallbackUrl, altText: fallbackAlt }]
        : [];

  const [activeId, setActiveId] = useState<string | null>(null);
  const active = gallery.find((i) => i.id === activeId) ?? gallery[0];

  if (!active) {
    return (
      <div className="overflow-hidden rounded-2xl bg-ink-850">
        <div className="flex aspect-[16/9] w-full items-center justify-center text-slate-600">
          <ImageOff className="h-10 w-10" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-ink-850">
        <div className="aspect-[16/9] w-full">
          <ImageWithFallback
            key={active.id}
            src={active.url}
            alt={active.altText ?? name}
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      {gallery.length > 1 && (
        <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {gallery.map((image, index) => {
            const selected = image.id === active.id;
            return (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(image.id)}
                  aria-label={image.altText ?? `Picture ${index + 1} of ${name}`}
                  aria-current={selected}
                  className={cn(
                    'h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition',
                    selected ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100',
                  )}
                >
                  <ImageWithFallback
                    src={image.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
