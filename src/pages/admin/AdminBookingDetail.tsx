import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarPlus, Download, Lock } from 'lucide-react';

import { adminBookings } from '@/api/bookings';
import { getAvailability } from '@/api/services';
import { adminStaffProfiles } from '@/api/staff';
import { ApiError } from '@/lib/http';
import { durationLabel, formatDateTimeInZone, money, zonedToday } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { useBookingsEntitlement } from '@/lib/useBookingsGate';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { AvailabilitySlot, BookingStatus } from '@/lib/types';
import {
  Button,
  Card,
  ConfirmDialog,
  DateStrip,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Select,
  SlotPicker,
  Textarea,
  Tooltip,
} from '@/components/ui';
import { InfoRow } from '@/components/summary';
import { DetailSkeleton } from '@/components/RouteSkeletons';
import { BookingSourceBadge, BookingStatusBadge } from '@/components/BookingStatusBadge';

/**
 * One appointment, from behind the counter.
 *
 * The state machine is the shape of this screen. A booking is born confirmed and
 * can only move forwards — completed, no-show or cancelled — and it can never
 * come back. Completing or marking a no-show is refused until the appointment
 * has actually started, so those controls are visibly unavailable until then
 * rather than failing on click: an explanation before the attempt is worth more
 * than an error after it.
 *
 * Staff have no cancellation cut-off. The customer's window can close while the
 * shop's stays open, which is exactly why the storefront's message tells people
 * to ring up.
 */
export default function AdminBookingDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const { timezone } = useBookingsEntitlement();

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  const query = useQuery({
    queryKey: ['admin', 'booking', id],
    queryFn: () => adminBookings.get(id),
    enabled: !!id,
  });
  const booking = query.data;
  useDocumentTitle(booking ? `Booking ${booking.bookingNumber}` : 'Booking');

  const staffQuery = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: adminStaffProfiles.list,
    staleTime: 5 * 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'booking', id] });
    qc.invalidateQueries({ queryKey: ['admin', 'bookings'] });
    qc.invalidateQueries({ queryKey: ['availability'] });
  };

  const onError = (e: unknown, title: string) => {
    if (e instanceof ApiError) {
      if (e.code === 'SLOT_NO_LONGER_AVAILABLE') {
        qc.invalidateQueries({ queryKey: ['availability'] });
        toast.error('That time is taken', 'Someone else is booked then — pick another.');
        return;
      }
      toast.error(title, e.message);
      return;
    }
    toast.error(title, 'Please try again.');
  };

  const statusMutation = useMutation({
    mutationFn: ({ status, why }: { status: Exclude<BookingStatus, 'CONFIRMED'>; why?: string }) =>
      adminBookings.setStatus(id, { status, reason: why }),
    onSuccess: () => {
      invalidate();
      setCancelOpen(false);
      toast.success('Booking updated');
    },
    onError: (e) => onError(e, 'Could not update the booking'),
  });

  const assignMutation = useMutation({
    mutationFn: (staffProfileId: string | null) => adminBookings.assignStaff(id, staffProfileId),
    onSuccess: () => {
      invalidate();
      toast.success('Assignment updated');
    },
    onError: (e) => onError(e, 'Could not assign'),
  });

  const rescheduleMutation = useMutation({
    mutationFn: (slot: AvailabilitySlot) => adminBookings.reschedule(id, slot.startsAt),
    onSuccess: () => {
      invalidate();
      setRescheduleOpen(false);
      toast.success('Booking moved', 'Same reference — the customer’s calendar entry updates itself.');
    },
    onError: (e) => onError(e, 'Could not move the booking'),
  });

  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError || !booking) {
    return (
      <EmptyState
        title="Booking not found"
        message="It may belong to another store, or have been removed."
        action={
          <Link to="/admin/bookings" className="rc-link">
            Back to the diary
          </Link>
        }
      />
    );
  }

  const started = new Date(booking.startsAt).getTime() <= Date.now();
  const open = booking.status === 'CONFIRMED';

  /** Completing and marking a no-show are both refused before the appointment
   *  has started. Disabled with the reason attached, rather than allowed and
   *  then rejected. */
  const outcomeButton = (label: string, status: 'COMPLETED' | 'NO_SHOW') => {
    const button = (
      <Button
        variant="outline"
        disabled={!started || statusMutation.isPending}
        onClick={() => statusMutation.mutate({ status })}
      >
        {label}
      </Button>
    );
    return started ? (
      button
    ) : (
      <Tooltip content="Available once the appointment has started">
        <span className="inline-flex">{button}</span>
      </Tooltip>
    );
  };

  return (
    <div>
      <Link
        to="/admin/bookings"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Diary
      </Link>

      <PageHeader
        title={booking.customerName}
        subtitle={`${booking.serviceName} · ${booking.bookingNumber}`}
        action={
          <div className="flex items-center gap-2">
            <BookingSourceBadge source={booking.source} />
            <BookingStatusBadge status={booking.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <dl>
              <InfoRow label="When">{formatDateTimeInZone(booking.startsAt, timezone)}</InfoRow>
              <InfoRow label="How long">
                {durationLabel(booking.durationMinutes)}
                {/* The customer never sees this; the diary always does. */}
                {booking.bufferMinutes > 0 && (
                  <span className="ml-1 text-xs text-slate-500">+{booking.bufferMinutes}m turnaround</span>
                )}
              </InfoRow>
              <InfoRow label="Price">{money(booking.price, booking.currency)}</InfoRow>
              <InfoRow label="Phone">{booking.customerPhone ?? '—'}</InfoRow>
              <InfoRow label="Email">{booking.customerEmail ?? '—'}</InfoRow>
              {booking.customerUserId == null && (
                <InfoRow label="Account">
                  <span className="text-slate-500">No account — taken in person or by phone</span>
                </InfoRow>
              )}
              {booking.notes && <InfoRow label="Customer note">{booking.notes}</InfoRow>}
              {booking.cancelledAt && (
                <InfoRow label="Cancelled">
                  {formatDateTimeInZone(booking.cancelledAt, timezone)}
                  {booking.cancelledBy === 'CUSTOMER' ? ' by the customer' : ' by the shop'}
                </InfoRow>
              )}
              {booking.cancellationReason && <InfoRow label="Reason">{booking.cancellationReason}</InfoRow>}
            </dl>
          </Card>

          {booking.internalNote && (
            <Card className="border-warning-500/30 bg-warning-500/5 p-6">
              <h2 className="flex items-center gap-2 text-h5 text-slate-100">
                <Lock className="h-4 w-4" aria-hidden /> Private note
              </h2>
              <p className="mt-2 whitespace-pre-line text-body-sm text-slate-300">{booking.internalNote}</p>
              <p className="mt-2 text-caption text-slate-500">Only your team can see this.</p>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-6">
            <h2 className="text-h5 text-slate-100">Assigned to</h2>
            <Select
              aria-label="Assigned team member"
              className="mt-3"
              value={booking.staffProfileId ?? ''}
              disabled={!open || assignMutation.isPending}
              onChange={(e) => assignMutation.mutate(e.target.value || null)}
            >
              <option value="">Nobody yet</option>
              {(staffQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                </option>
              ))}
            </Select>
            {/* The clash check applies here too: somebody already busy then
                cannot be given a second appointment. */}
            <p className="mt-2 text-caption text-slate-500">
              Someone already booked at this time cannot be assigned.
            </p>
          </Card>

          {open && (
            <Card className="p-6">
              <h2 className="text-h5 text-slate-100">Outcome</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {outcomeButton('Completed', 'COMPLETED')}
                {outcomeButton('No-show', 'NO_SHOW')}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-700 pt-4">
                <Button variant="outline" onClick={() => setRescheduleOpen(true)}>
                  Move
                </Button>
                <Button variant="danger" onClick={() => setCancelOpen(true)}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-h5 text-slate-100">Calendar</h2>
            <div className="mt-3 flex flex-col gap-2">
              {/* Styled as a control rather than as prose. It was a text link and
                  read as a caption, so the .ics button looked like the only way to
                  get an appointment into a calendar. */}
              <a
                href={booking.googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-600 px-4 py-2 text-body-sm font-medium text-slate-200 transition hover:border-slate-100"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden /> Add to Google Calendar
              </a>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  adminBookings
                    .downloadIcs(booking.id, booking.bookingNumber)
                    .catch(() => toast.error('Download failed', 'The calendar file could not be produced.'))
                }
              >
                <Download className="h-4 w-4" aria-hidden /> Download .ics
              </Button>
            </div>
          </Card>
        </aside>
      </div>

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

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this booking?"
        description="The customer is told, and the time goes back into the diary."
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep it"
        destructive
        loading={statusMutation.isPending}
        onConfirm={() => statusMutation.mutate({ status: 'CANCELLED', why: reason.trim() || undefined })}
      />
    </div>
  );
}

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
      title="Move this booking"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Keep the current time
          </Button>
          <Button disabled={!selected} loading={submitting} onClick={() => selected && onPick(selected)}>
            Move it
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <DateStrip value={date} timezone={timezone} daysToShow={5} onChange={(d) => { setDate(d); setSelected(null); }} />
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
