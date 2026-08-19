import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarClock, ChevronRight } from 'lucide-react';

import { listMyBookings } from '@/api/bookings';
import { durationLabel, formatDateTimeInZone } from '@/lib/format';
import { useBookingsEnabled } from '@/lib/useBookingsGate';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { BookingResponse } from '@/lib/types';
import { Card, EmptyState, LinkButton, Pagination } from '@/components/ui';
import { ListSkeleton } from '@/components/RouteSkeletons';
import { BookingStatusBadge } from '@/components/BookingStatusBadge';

const PAGE_SIZE = 10;

/**
 * Everything this customer has booked.
 *
 * Split into what is still coming and what has been, because those are two
 * different needs: the first is something they may still want to change, the
 * second is a record. The split is done here from one page of results rather
 * than with two requests — the server sorts newest-first and has no "upcoming"
 * filter, and asking twice to save one array partition would be the wrong
 * trade.
 */
export default function MyBookings() {
  const { timezone } = useBookingsEnabled();
  const [page, setPage] = useState(0);
  useDocumentTitle('My bookings');

  const query = useQuery({
    queryKey: ['bookings', 'mine', page],
    queryFn: () => listMyBookings({ page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  if (query.isLoading) return <ListSkeleton />;

  const bookings = query.data?.content ?? [];
  const now = Date.now();
  const upcoming = bookings.filter((b) => b.status === 'CONFIRMED' && new Date(b.startsAt).getTime() >= now);
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-display-sm font-semibold text-slate-100">My bookings</h1>

      {query.isError ? (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" aria-hidden />}
          title="We couldn’t load your bookings"
          message="Please try again in a moment."
        />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" aria-hidden />}
          title="Nothing booked yet"
          message="When you book an appointment it will show up here."
          action={<LinkButton to="/services">Browse services</LinkButton>}
        />
      ) : (
        <div className="mt-8 space-y-10">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-h5 text-slate-100">Coming up</h2>
              <ul className="space-y-3">
                {upcoming.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} timezone={timezone} highlight />
                ))}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-h5 text-slate-100">Past and cancelled</h2>
              <ul className="space-y-3">
                {past.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} timezone={timezone} />
                ))}
              </ul>
            </section>
          )}

          {(query.data?.totalPages ?? 0) > 1 && (
            <Pagination page={query.data?.number ?? 0} totalPages={query.data?.totalPages ?? 0} onChange={setPage} />
          )}
        </div>
      )}
    </div>
  );
}

function BookingRow({
  booking,
  timezone,
  highlight = false,
}: {
  booking: BookingResponse;
  timezone: string;
  highlight?: boolean;
}) {
  return (
    <li>
      <Card className={highlight ? 'p-0 ring-1 ring-primary/20' : 'p-0'}>
        <Link
          to={`/account/bookings/${booking.id}`}
          className="flex items-center gap-4 px-5 py-4 transition hover:bg-ink-850/60"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="font-medium text-slate-100">{booking.serviceName}</span>
              <BookingStatusBadge status={booking.status} />
            </div>
            {/* The shop's clock, always — this is the time they have to arrive. */}
            <p className="mt-1 text-body-sm text-slate-400">
              {formatDateTimeInZone(booking.startsAt, timezone)} · {durationLabel(booking.durationMinutes)}
              {booking.staffName ? ` · with ${booking.staffName}` : ''}
            </p>
            <p className="mt-0.5 text-caption tabular-nums text-slate-500">{booking.bookingNumber}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        </Link>
      </Card>
    </li>
  );
}
