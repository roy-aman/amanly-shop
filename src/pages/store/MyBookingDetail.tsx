import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarPlus, Download, MapPin, Phone } from 'lucide-react';

import { cancelBooking, downloadBookingIcs, getMyBooking, rescheduleBooking } from '@/api/bookings';
import { getAvailability } from '@/api/services';
import { ApiError } from '@/lib/http';
import { durationLabel, formatDateTimeInZone, money, zonedToday } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { useBookingsEnabled } from '@/lib/useBookingsGate';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { AvailabilitySlot } from '@/lib/types';
import {
  Button,
  Card,
  DateStrip,
  EmptyState,
  Field,
  Modal,
  SlotPicker,
  Textarea,
} from '@/components/ui';
import { InfoRow } from '@/components/summary';
import { DetailSkeleton } from '@/components/RouteSkeletons';
import { BookingStatusBadge } from '@/components/BookingStatusBadge';

/**
 * One booking, and the two things a customer might want to do to it.
 *
 * Both controls are offered on any confirmed appointment still in the future,
 * even though the shop may have a cut-off that has already passed. That is
 * deliberate: how many hours before the appointment changes stop being allowed
 * is not published on any endpoint the storefront can read, so the only honest
 * options are to hide the buttons from everyone or to let the server be the
 * boundary. The server's refusal is a clear, specific answer, and it comes with
 * a way forward — call the shop — which a greyed-out button never does.
 */
export default function MyBookingDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const { timezone, businessAddress } = useBookingsEnabled();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cutoffPassed, setCutoffPassed] = useState(false);

  const query = useQuery({
    queryKey: ['bookings', id],
    queryFn: () => getMyBooking(id),
    enabled: !!id,
  });
  const booking = query.data;
  useDocumentTitle(booking ? `Booking ${booking.bookingNumber}` : 'Booking');

  /** Both mutations share this: a change here moves a slot in the shop's diary,
   *  so anything showing availability is now out of date too. */
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bookings'] });
    qc.invalidateQueries({ queryKey: ['availability'] });
  };

  const handleError = (e: unknown, fallbackTitle: string) => {
    if (e instanceof ApiError) {
      if (e.code === 'BOOKING_CUTOFF_PASSED') {
        // Not a failure the customer caused, and not one they can retry out of.
        setCutoffPassed(true);
        setCancelOpen(false);
        setRescheduleOpen(false);
        return;
      }
      toast.error(fallbackTitle, e.message);
      return;
    }
    toast.error(fallbackTitle, 'Please try again.');
  };

  const cancelMutation = useMutation({
    mutationFn: () => cancelBooking(id, reason.trim() || undefined),
    onSuccess: () => {
      invalidate();
      setCancelOpen(false);
      toast.success('Booking cancelled', 'We have let the shop know.');
    },
    onError: (e) => handleError(e, 'Could not cancel'),
  });

  const rescheduleMutation = useMutation({
    mutationFn: (slot: AvailabilitySlot) => rescheduleBooking(id, slot.startsAt),
    onSuccess: () => {
      invalidate();
      setRescheduleOpen(false);
      toast.success('Booking moved', 'Same booking number — your calendar entry will update itself.');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'SLOT_NO_LONGER_AVAILABLE') {
        qc.invalidateQueries({ queryKey: ['availability'] });
        toast.error('That time has gone', 'Someone else took it. Please pick another.');
        return;
      }
      handleError(e, 'Could not move the booking');
    },
  });

  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError || !booking) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState
          title="Booking not found"
          message="This booking does not exist, or it is not yours."
          action={
            <Link to="/account/bookings" className="rc-link">
              Back to my bookings
            </Link>
          }
        />
      </div>
    );
  }

  const upcoming = new Date(booking.startsAt).getTime() > Date.now();
  const changeable = booking.status === 'CONFIRMED' && upcoming;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/account/bookings" className="inline-flex items-center gap-1.5 text-body-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" aria-hidden /> My bookings
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-display-sm font-semibold text-slate-100">{booking.serviceName}</h1>
        <BookingStatusBadge status={booking.status} />
      </div>
      <p className="mt-1 text-body-sm tabular-nums text-slate-500">{booking.bookingNumber}</p>

      <Card className="mt-8 p-6">
        <dl>
          <InfoRow label="When">{formatDateTimeInZone(booking.startsAt, timezone)}</InfoRow>
          <InfoRow label="How long">{durationLabel(booking.durationMinutes)}</InfoRow>
          <InfoRow label="With">{booking.staffName ?? 'Whoever is free'}</InfoRow>
          <InfoRow label={booking.status === 'COMPLETED' ? 'Paid at the venue' : 'To pay at the venue'}>
            {money(booking.price, booking.currency)}
          </InfoRow>
          {booking.notes && <InfoRow label="Your note">{booking.notes}</InfoRow>}
          {booking.cancellationReason && <InfoRow label="Reason">{booking.cancellationReason}</InfoRow>}
        </dl>
        {businessAddress && (
          <p className="mt-4 flex items-start gap-2 border-t border-ink-700 pt-4 text-body-sm text-slate-400">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="whitespace-pre-line">{businessAddress}</span>
          </p>
        )}
      </Card>

      {cutoffPassed && (
        <p
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-lg border border-warning-500/30 bg-warning-500/10 px-4 py-3 text-body-sm text-warning-300"
        >
          <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            It is too close to your appointment to change it online. Please contact the store and they
            will sort it out with you.
          </span>
        </p>
      )}

      {booking.status === 'CONFIRMED' && (
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={booking.googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-4 py-2.5 text-body-sm font-medium text-slate-200 transition hover:border-slate-100"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden /> Add to Google Calendar
          </a>
          <Button
            variant="outline"
            onClick={() =>
              downloadBookingIcs(booking.id, booking.bookingNumber).catch(() =>
                toast.error('Download failed', 'The calendar file could not be produced.'),
              )
            }
          >
            <Download className="h-4 w-4" aria-hidden /> Download calendar file
          </Button>
        </div>
      )}

      {changeable && (
        <div className="mt-8 border-t border-ink-700 pt-6">
          <h2 className="text-h5 text-slate-100">Need to change something?</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setRescheduleOpen(true)}>
              Move to another time
            </Button>
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              Cancel booking
            </Button>
          </div>
          {/* Worth saying out loud: people expect a moved appointment to leave a
              stale duplicate in their calendar, and this one does not. */}
          <p className="mt-3 text-caption text-slate-500">
            Moving keeps the same booking number, and any calendar entry you added updates itself.
          </p>
        </div>
      )}

      {/* A Modal rather than ConfirmDialog: this confirmation carries a field,
          and an alert dialog's description is not a place to put a form. */}
      {cancelOpen && (
        <Modal
          open
          onClose={() => setCancelOpen(false)}
          title="Cancel this booking?"
          footer={
            <>
              <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelMutation.isPending}>
                Keep it
              </Button>
              {/* Not "Cancel booking" again: repeating the trigger's wording
                  inside its own confirmation leaves two identically-named
                  buttons on screen, and "cancel" in a dialog is already
                  ambiguous enough. */}
              <Button variant="danger" loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
                Yes, cancel it
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Said plainly because people brace for a cancellation fee: there is
                nothing to refund precisely because nothing was taken. */}
            <p className="text-body-sm text-slate-300">
              Your time will be released for someone else. There is nothing to refund — you had not paid.
            </p>
            <Field label="Anything you would like to tell the shop?" hint="Optional">
              <Textarea
                aria-label="Reason for cancelling"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </div>
        </Modal>
      )}

      {rescheduleOpen && (
        <RescheduleDialog
          serviceId={booking.serviceOfferingId}
          staffProfileId={booking.staffProfileId}
          timezone={timezone}
          submitting={rescheduleMutation.isPending}
          onClose={() => setRescheduleOpen(false)}
          onPick={(slot) => rescheduleMutation.mutate(slot)}
        />
      )}
    </div>
  );
}

/**
 * The same day strip and slot picker the wizard uses, in a dialog.
 *
 * It asks for availability of the SAME staff member the booking already has, so
 * moving an appointment does not quietly reassign the person the customer chose.
 */
function RescheduleDialog({
  serviceId,
  staffProfileId,
  timezone,
  submitting,
  onClose,
  onPick,
}: {
  serviceId: string;
  staffProfileId: string | null;
  timezone: string;
  submitting: boolean;
  onClose: () => void;
  onPick: (slot: AvailabilitySlot) => void;
}) {
  const [date, setDate] = useState(() => zonedToday(timezone));
  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);

  const availabilityQuery = useQuery({
    queryKey: ['availability', serviceId, date, staffProfileId ?? 'any'],
    queryFn: () => getAvailability(serviceId, date, staffProfileId ?? undefined),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Move your booking"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Keep the current time
          </Button>
          <Button disabled={!selected} loading={submitting} onClick={() => selected && onPick(selected)}>
            Move to this time
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <DateStrip
          value={date}
          timezone={timezone}
          daysToShow={5}
          onChange={(next) => {
            setDate(next);
            setSelected(null);
          }}
        />
        <SlotPicker
          slots={availabilityQuery.data?.slots ?? []}
          value={selected?.startsAt}
          loading={availabilityQuery.isLoading}
          onChange={setSelected}
        />
      </div>
    </Modal>
  );
}
