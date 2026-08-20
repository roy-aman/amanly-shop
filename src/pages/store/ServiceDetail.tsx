import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, MapPin } from 'lucide-react';

import { getBusinessHours, getService } from '@/api/services';
import { listStaff } from '@/api/staff';
import { durationLabel, formatWallClock, money, weekdayName } from '@/lib/format';
import { useBookingsEnabled } from '@/lib/useBookingsGate';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { usePageMeta } from '@/lib/usePageMeta';
import { Card, ImageWithFallback, LinkButton, RatingStars } from '@/components/ui';
import { ProductDetailSkeleton } from '@/components/RouteSkeletons';
import ServiceReviews from '@/components/ServiceReviews';
import { ServiceGallery } from '@/components/ServiceGallery';
import NotFound from '@/pages/NotFound';

/** Monday-first, ISO order — the same order the backend numbers them in. */
const WEEK = [1, 2, 3, 4, 5, 6, 7];

/**
 * One service, and the answer to "can I have it on Thursday".
 *
 * Kept light on purpose: this is a browsing page, and everything that makes
 * booking work — the availability calls, the slot state, the sign-in hand-off —
 * lives on /book/:slug instead. Loading that machinery here would put it in
 * front of everyone reading the menu.
 *
 * The opening-hours table is here rather than only in a footer because it
 * answers the question people actually arrive with, and because a shop that is
 * shut on Sunday should say so before someone picks Sunday and finds no times.
 */
export default function ServiceDetail() {
  const { slug = '' } = useParams();
  const { enabled, loading: gateLoading, businessAddress } = useBookingsEnabled();

  const serviceQuery = useQuery({
    queryKey: ['service', slug],
    queryFn: () => getService(slug),
    enabled: enabled && !!slug,
  });

  const hoursQuery = useQuery({
    queryKey: ['business-hours'],
    queryFn: getBusinessHours,
    staleTime: 5 * 60_000,
    enabled,
  });

  const staffQuery = useQuery({
    queryKey: ['staff', serviceQuery.data?.id ?? 'all'],
    queryFn: () => listStaff(serviceQuery.data?.id),
    staleTime: 5 * 60_000,
    enabled: enabled && !!serviceQuery.data?.id,
  });

  const service = serviceQuery.data;
  useDocumentTitle(service?.name ?? 'Service');
  usePageMeta({
    description: service?.description ?? undefined,
    canonicalPath: service ? `/services/${service.slug}` : undefined,
  });

  if (gateLoading || serviceQuery.isLoading) return <ProductDetailSkeleton />;
  // Both "this shop has no services" and "no such service" land here. The
  // backend answers 404 for a service belonging to another shop too, by design.
  if (!enabled || serviceQuery.isError || !service) return <NotFound />;

  const hasRating = service.ratingAvg != null && service.ratingCount > 0;
  const hours = hoursQuery.data?.businessHours ?? [];
  const staff = staffQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="mb-6 text-body-sm text-slate-400">
        <Link to="/services" className="rc-link">
          Services
        </Link>
        <span className="mx-2 text-slate-600">/</span>
        <span className="text-slate-300">{service.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <ServiceGallery
            images={service.images ?? []}
            fallbackUrl={service.imageUrl}
            fallbackAlt={service.imageAltText}
            name={service.name}
          />

          <div className="mt-8">
            {service.categoryName && (
              <p className="text-overline uppercase text-slate-500">{service.categoryName}</p>
            )}
            <h1 className="mt-1 text-display-sm font-semibold text-slate-100">{service.name}</h1>
            {hasRating && (
              <div className="mt-3">
                <RatingStars value={service.ratingAvg as number} count={service.ratingCount} />
              </div>
            )}
            {service.description && (
              <p className="mt-5 whitespace-pre-line text-body text-slate-300">{service.description}</p>
            )}
          </div>

          {staff.length > 0 && (
            <section className="mt-10">
              <h2 className="text-h4 text-slate-100">Who you might see</h2>
              {/* These are the people who work in this service's group — the
                  server narrows the list, so the page is not implying a filter it
                  did not apply. A service with no group shows the whole team,
                  which is still true rather than merely unfiltered. */}
              <p className="mt-1 text-body-sm text-slate-400">
                You can ask for someone in particular when you book, or leave it to us.
              </p>
              <ul className="mt-5 flex flex-wrap gap-6">
                {staff.map((person) => (
                  <li key={person.id} className="flex w-36 flex-col items-center text-center">
                    <div className="h-20 w-20 overflow-hidden rounded-full bg-ink-800">
                      {person.photoUrl ? (
                        <ImageWithFallback
                          src={person.photoUrl}
                          alt={person.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-h4 text-slate-500">
                          {person.displayName.charAt(0)}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-body-sm font-medium text-slate-200">{person.displayName}</p>
                    {person.title && <p className="text-caption text-slate-500">{person.title}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-12">
            <ServiceReviews serviceId={service.id} />
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <p className="text-display-xs font-semibold text-slate-100">
              {money(service.price, service.currency)}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-body-sm text-slate-400">
              <Clock className="h-4 w-4" aria-hidden />
              {durationLabel(service.durationMinutes)}
            </p>

            <LinkButton to={`/book/${service.slug}`} size="lg" fullWidth className="mt-6">
              Book this service
            </LinkButton>
            {/* Said here, before anyone commits to a time. A customer who expects
                a payment step and does not find one assumes the booking failed. */}
            <p className="mt-3 text-center text-caption text-slate-500">
              No payment now — you pay at the venue.
            </p>
          </Card>

          {hours.length > 0 && (
            <Card className="mt-6 p-6">
              <h2 className="text-h5 text-slate-100">Opening hours</h2>
              <dl className="mt-4 space-y-1.5">
                {WEEK.map((weekday) => {
                  const day = hours.find((h) => h.weekday === weekday);
                  return (
                    <div key={weekday} className="flex justify-between gap-4 text-body-sm">
                      <dt className="text-slate-400">{weekdayName(weekday)}</dt>
                      {/* A weekday absent from the list is closed — the API has
                          no flag for it, absence IS the flag. */}
                      <dd className={day ? 'tabular-nums text-slate-200' : 'text-slate-500'}>
                        {day ? `${formatWallClock(day.openTime)} – ${formatWallClock(day.closeTime)}` : 'Closed'}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {businessAddress && (
                <p className="mt-5 flex items-start gap-2 border-t border-ink-700 pt-4 text-body-sm text-slate-400">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="whitespace-pre-line">{businessAddress}</span>
                </p>
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
