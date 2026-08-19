import { Link } from 'react-router-dom';
import { Clock, ImageOff } from 'lucide-react';

import { durationLabel, money } from '@/lib/format';
import type { ServiceOfferingResponse } from '@/lib/types';
import { RatingStars, cn, revealOnLoad } from '@/components/ui';

/**
 * A service in a list.
 *
 * Built beside ProductCard and on purpose not out of it. A service has no stock,
 * no variants and nothing to add to a bag — what it has instead is a duration,
 * and that is the field people actually compare on when they are deciding how to
 * spend an afternoon. So duration sits next to the price rather than in a
 * details list, and the card's one call to action is to book rather than to buy.
 *
 * The image is 16:9 rather than the catalogue's 4:5 portrait: service pictures
 * are rooms, chairs and people at work, which are wider than they are tall, and
 * a portrait crop of a treatment room mostly shows the ceiling.
 */
export default function ServiceCard({ service }: { service: ServiceOfferingResponse }) {
  const hasRating = service.ratingAvg != null && service.ratingCount > 0;

  return (
    <div className="group relative flex h-full flex-col">
      <div className="relative overflow-hidden rounded-xl bg-ink-850">
        <div className="aspect-[16/9] w-full">
          {service.imageUrl ? (
            <img
              src={service.imageUrl}
              alt={service.imageAltText ?? service.name}
              loading="lazy"
              {...revealOnLoad}
              className="rc-img h-full w-full object-cover duration-[900ms] ease-emphasized group-hover:scale-[1.06]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-600">
              <ImageOff className="h-8 w-8" aria-hidden />
            </div>
          )}
        </div>
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 pt-3.5">
        {service.categoryName && (
          <p className="text-overline uppercase text-slate-500">{service.categoryName}</p>
        )}

        <h3 className="line-clamp-2 min-h-[3.1em] text-body-sm font-medium text-slate-100 transition-colors duration-300 group-hover:text-slate-400">
          {/* Stretched link: the whole card is one target and one accessible
              name, the same idiom the product grid uses. */}
          <Link
            to={`/services/${service.slug}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70"
          >
            {service.name}
          </Link>
        </h3>

        {/* Shown only once a review exists — never an empty five-star row with
            "(0)" beside it, which reads as a bad rating rather than as none. */}
        {hasRating && (
          <RatingStars value={service.ratingAvg as number} count={service.ratingCount} size="sm" />
        )}

        <div className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-2">
          <span className="text-body font-semibold text-slate-100">
            {money(service.price, service.currency)}
          </span>
          <span className={cn('inline-flex items-center gap-1 text-body-sm text-slate-400')}>
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {durationLabel(service.durationMinutes)}
          </span>
        </div>
      </div>
    </div>
  );
}
