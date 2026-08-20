import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CalendarPlus, ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react';

import { adminBookings } from '@/api/bookings';
import { adminServices, getAvailability, getBusinessHours } from '@/api/services';
import { adminStaffProfiles } from '@/api/staff';
import { ApiError } from '@/lib/http';
import {
  addDaysISO,
  formatDateTimeInZone,
  formatISODateLabel,
  weekdayFromISODate,
  zonedToday,
  zonedWallClockToInstant,
} from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useBookingsEntitlement } from '@/lib/useBookingsGate';
import type { AdminBookingResponse, AvailabilitySlot, BookingStatus, CreateWalkInBookingRequest } from '@/lib/types';
import {
  Button,
  Card,
  DataTable,
  DateStrip,
  EmptyState,
  Field,
  FilterChip,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  SlotPicker,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  type Column,
} from '@/components/ui';
import { DayTimeline } from '@/components/admin/DayTimeline';
import { BookingSourceBadge, BookingStatusBadge } from '@/components/BookingStatusBadge';

const STATUSES: BookingStatus[] = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
const LIST_SIZE = 50;
/** One day never runs to two hundred appointments; asking for that many is what
 *  keeps the timeline a single request instead of a paging loop. */
const DAY_SIZE = 200;

/**
 * The diary.
 *
 * Two views of one thing, and which one leads matters: a front desk opens this
 * to see today, not to search history, so the timeline is the default and the
 * list is there when somebody rings up about next month. Both live under one
 * route with the view in the URL, because they are the same resource seen two
 * ways — and because a refresh should not throw away which one you were on.
 *
 * The day view asks for a single day, converting the shop's local midnight into
 * the instants the server wants. Getting that conversion wrong silently drops
 * the first and last appointments of the day, which is why it goes through the
 * shared helper rather than being done inline.
 */
export default function AdminBookings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { bookingsAllowed, loading: entitlementLoading, timezone } = useBookingsEntitlement();
  const { isAdmin } = useAuth();

  const view = searchParams.get('view') === 'list' ? 'list' : 'today';
  const date = searchParams.get('date') ?? zonedToday(timezone);

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [walkInOpen, setWalkInOpen] = useState(false);
  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setSearchParams(next, { replace: true });
  };

  // In the URL rather than in state: the team page links straight to one
  // person's diary, and that link has to arrive already filtered.
  const staffId = searchParams.get('staffId') ?? '';
  const setStaffId = (next: string) => {
    setParam({ staffId: next });
    setPage(0);
  };

  const staffQuery = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: adminStaffProfiles.list,
    staleTime: 5 * 60_000,
    enabled: bookingsAllowed,
  });

  const hoursQuery = useQuery({
    queryKey: ['business-hours'],
    queryFn: getBusinessHours,
    staleTime: 5 * 60_000,
    enabled: bookingsAllowed,
  });

  // The shop's day, expressed as the instants the server filters on.
  const dayQuery = useQuery({
    queryKey: ['admin', 'bookings', 'day', date],
    queryFn: () =>
      adminBookings.list({
        from: zonedWallClockToInstant(date, 0, timezone),
        to: zonedWallClockToInstant(addDaysISO(date, 1), 0, timezone),
        size: DAY_SIZE,
      }),
    enabled: bookingsAllowed && view === 'today',
    // A shared counter screen: short shelf life, and refreshed whenever someone
    // comes back to the tab.
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const listQuery = useQuery({
    queryKey: ['admin', 'bookings', { search, status, staffId, page }],
    queryFn: () =>
      adminBookings.list({
        q: search || undefined,
        status: status || undefined,
        staffId: staffId || undefined,
        page,
        size: LIST_SIZE,
      }),
    placeholderData: keepPreviousData,
    enabled: bookingsAllowed && view === 'list',
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, staffProfileId }: { id: string; staffProfileId: string | null }) =>
      adminBookings.assignStaff(id, staffProfileId),
    onSuccess: (booking) => {
      qc.invalidateQueries({ queryKey: ['admin', 'bookings'] });
      toast.success(booking.staffName ? `Assigned to ${booking.staffName}` : 'Unassigned');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'SLOT_NO_LONGER_AVAILABLE') {
        // Somebody already has an appointment then — the same clash rule that
        // governs booking, applied to who does the work.
        toast.error('They are busy then', 'That person already has an appointment at this time.');
        return;
      }
      toast.error('Could not assign', e instanceof ApiError ? e.message : 'Please try again.');
    },
  });

  const walkInMutation = useMutation({
    mutationFn: (body: CreateWalkInBookingRequest) => adminBookings.createWalkIn(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'bookings'] });
      qc.invalidateQueries({ queryKey: ['availability'] });
      setWalkInOpen(false);
      toast.success('Booking taken');
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.code === 'SLOT_NO_LONGER_AVAILABLE') {
          // Walk-ins skip the lead-time rules but never the clash check.
          qc.invalidateQueries({ queryKey: ['availability'] });
          toast.error('That time has just gone', 'Pick another — the times shown have been refreshed.');
          return;
        }
        toast.error('Could not take the booking', e.message);
        return;
      }
      toast.error('Could not take the booking', 'Please try again.');
    },
  });

  const columns: Column<AdminBookingResponse>[] = useMemo(
    () => [
      {
        key: 'startsAt',
        header: 'When',
        render: (b) => <span className="text-slate-200">{formatDateTimeInZone(b.startsAt, timezone)}</span>,
      },
      {
        key: 'customerName',
        header: 'Customer',
        render: (b) => (
          <div className="min-w-0">
            <span className="block truncate font-medium text-slate-100">{b.customerName}</span>
            {b.customerPhone && <span className="block truncate text-xs text-slate-500">{b.customerPhone}</span>}
          </div>
        ),
      },
      { key: 'serviceName', header: 'Service' },
      {
        key: 'assign',
        header: 'Assign',
        // Assigning from the row rather than only from the booking's own page:
        // sorting out who is doing what is a pass down a list, not eight visits
        // to eight pages. The server still refuses anyone already busy then.
        render: (b) =>
          b.status === 'CONFIRMED' ? (
            <Select
              aria-label={`Assign ${b.customerName}'s booking`}
              value={b.staffProfileId ?? ''}
              disabled={assignMutation.isPending && assignMutation.variables?.id === b.id}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                assignMutation.mutate({ id: b.id, staffProfileId: e.target.value || null });
              }}
              className="min-w-[9rem]"
            >
              <option value="">Unassigned</option>
              {(staffQuery.data ?? [])
                .filter((s) => s.active || s.id === b.staffProfileId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
            </Select>
          ) : (
            <span className="text-xs text-slate-500">—</span>
          ),
      },
      {
        key: 'calendar',
        header: 'Calendar',
        // Reachable from the list, not only from inside each booking. Staff put
        // their day into their own calendar one row at a time.
        render: (b) => (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <a
              href={b.googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Add ${b.customerName} to Google Calendar`}
              className="rounded-lg border border-ink-600 p-1.5 text-slate-300 transition hover:border-slate-100 hover:text-slate-100"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden />
            </a>
            <button
              type="button"
              aria-label={`Download ${b.customerName}'s appointment`}
              onClick={() =>
                adminBookings
                  .downloadIcs(b.id, b.bookingNumber)
                  .catch(() => toast.error('Download failed', 'The calendar file could not be produced.'))
              }
              className="rounded-lg border border-ink-600 p-1.5 text-slate-300 transition hover:border-slate-100 hover:text-slate-100"
            >
              <Download className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ),
      },
      { key: 'source', header: 'Taken', render: (b) => <BookingSourceBadge source={b.source} /> },
      { key: 'status', header: 'Status', render: (b) => <BookingStatusBadge status={b.status} /> },
      {
        key: 'bookingNumber',
        header: 'Reference',
        render: (b) => <span className="font-mono text-xs text-slate-400">{b.bookingNumber}</span>,
      },
    ],
    [timezone, staffQuery.data, assignMutation, toast],
  );

  if (entitlementLoading) return null;
  if (!bookingsAllowed) {
    return (
      <EmptyState
        icon={<CalendarClock className="h-6 w-6" aria-hidden />}
        title="Bookings aren’t part of this store’s plan"
        message="Get in touch with us and we can switch appointments on for you."
      />
    );
  }

  const weekdayHours = hoursQuery.data?.businessHours.find((h) => h.weekday === weekdayFromISODate(date));

  return (
    <div>
      {/* The server narrows a staff member's diary to their own work; saying so
          stops a thinner-than-expected day reading as data loss. */}
      {!isAdmin && (
        <p className="mb-4 rounded-lg border border-ink-700 bg-ink-850/60 px-4 py-2.5 text-body-sm text-slate-400">
          You are seeing appointments assigned to you, plus any nobody has taken yet. If this looks
          empty, ask an admin to link your account to your team profile.
        </p>
      )}

      <PageHeader
        title="Diary"
        subtitle={isAdmin ? 'Everything booked, and what today looks like.' : 'Your appointments.'}
        action={
          <Button onClick={() => setWalkInOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Take a booking
          </Button>
        }
      />

      <Tabs value={view} onValueChange={(v) => setParam({ view: v === 'today' ? '' : v })}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="list">All bookings</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <Card className="p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" aria-label="Previous day" onClick={() => setParam({ date: addDaysISO(date, -1) })}>
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
                <span className="min-w-[9rem] text-center text-body-sm font-medium text-slate-200">
                  {formatISODateLabel(date, { weekday: 'long', day: 'numeric', month: 'short' })}
                </span>
                <Button variant="ghost" size="sm" aria-label="Next day" onClick={() => setParam({ date: addDaysISO(date, 1) })}>
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
                {date !== zonedToday(timezone) && (
                  <Button variant="ghost" size="sm" onClick={() => setParam({ date: '' })}>
                    Today
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {weekdayHours ? `Open ${weekdayHours.openTime}–${weekdayHours.closeTime}` : 'Closed this day'}
              </p>
            </div>

            {dayQuery.isLoading ? (
              <p className="py-16 text-center text-body-sm text-slate-500">Loading the day…</p>
            ) : dayQuery.isError ? (
              <EmptyState title="Could not load the day" message="Please try again shortly." />
            ) : (
              <DayTimeline
                bookings={dayQuery.data?.content ?? []}
                timezone={timezone}
                date={date}
                hours={weekdayHours ?? null}
                onSelect={(b) => navigate(`/admin/bookings/${b.id}`)}
              />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="list">
          <Card className="p-4">
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SearchInput
                defaultValue={search}
                onSearch={(v) => {
                  setSearch(v);
                  setPage(0);
                }}
                placeholder="Booking number, name or phone"
              />
              <Select aria-label="Filter by team member" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">Anyone</option>
                {(staffQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </Select>
            </div>

            {staffId && (
              <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-ink-700 bg-ink-850/60 px-3 py-2 text-body-sm text-slate-300">
                Showing only{' '}
                <span className="font-medium text-slate-100">
                  {(staffQuery.data ?? []).find((s) => s.id === staffId)?.displayName ?? 'one team member'}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setStaffId('')}>
                  Show everyone
                </Button>
              </p>
            )}

            <div className="mb-4 flex flex-wrap gap-2">
              <FilterChip selected={!status} onClick={() => { setStatus(''); setPage(0); }}>
                All
              </FilterChip>
              {STATUSES.map((s) => (
                <FilterChip
                  key={s}
                  selected={status === s}
                  onClick={() => {
                    setStatus(s);
                    setPage(0);
                  }}
                >
                  {s === 'NO_SHOW' ? 'No-show' : s.charAt(0) + s.slice(1).toLowerCase()}
                </FilterChip>
              ))}
            </div>

            {listQuery.isError ? (
              <EmptyState title="Could not load bookings" message="Please try again shortly." />
            ) : (
              <DataTable
                columns={columns}
                data={listQuery.data?.content ?? []}
                getRowKey={(b) => b.id}
                loading={listQuery.isLoading}
                onRowClick={(b) => navigate(`/admin/bookings/${b.id}`)}
                empty={
                  <EmptyState
                    icon={<CalendarClock className="h-6 w-6" aria-hidden />}
                    title="Nothing matches"
                    message="Try a different search or clear the filters."
                  />
                }
              />
            )}

            {(listQuery.data?.totalPages ?? 0) > 1 && (
              <Pagination
                page={listQuery.data?.number ?? 0}
                totalPages={listQuery.data?.totalPages ?? 0}
                onChange={setPage}
              />
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {walkInOpen && (
        <WalkInDialog
          timezone={timezone}
          submitting={walkInMutation.isPending}
          onClose={() => setWalkInOpen(false)}
          onSubmit={(body) => walkInMutation.mutate(body)}
        />
      )}
    </div>
  );
}

/**
 * Taking a booking for somebody at the counter or on the phone.
 *
 * The customer here may have no account at all, which is why a name is required
 * and an email is not. The times on offer are the same ones the storefront sees:
 * the shop's own rules about notice and how far ahead still shape them, except
 * that staff are allowed to book inside the notice period — the one rule that is
 * never waived is that two people cannot have the same slot.
 */
function WalkInDialog({
  timezone,
  submitting,
  onClose,
  onSubmit,
}: {
  timezone: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (body: CreateWalkInBookingRequest) => void;
}) {
  const [serviceId, setServiceId] = useState('');
  const [staffProfileId, setStaffProfileId] = useState('');
  const [date, setDate] = useState(() => zonedToday(timezone));
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [source, setSource] = useState<'WALK_IN' | 'PHONE'>('WALK_IN');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ['admin', 'services', 'all'],
    queryFn: () => adminServices.list({ size: 200 }),
    staleTime: 5 * 60_000,
  });
  const staffQuery = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: adminStaffProfiles.list,
    staleTime: 5 * 60_000,
  });

  const availabilityQuery = useQuery({
    queryKey: ['availability', serviceId, date, staffProfileId || 'any'],
    queryFn: () => getAvailability(serviceId, date, staffProfileId || undefined),
    enabled: !!serviceId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  function submit() {
    if (!customerName.trim()) {
      setNameError('A name is required — this is who the appointment is for.');
      return;
    }
    if (!serviceId || !slot) return;
    onSubmit({
      serviceOfferingId: serviceId,
      startsAt: slot.startsAt,
      staffProfileId: staffProfileId || undefined,
      source,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      notes: notes.trim() || undefined,
      internalNote: internalNote.trim() || undefined,
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Take a booking"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting} disabled={!serviceId || !slot}>
            Book it in
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Service" required>
            <Select
              aria-label="Service"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setSlot(null);
              }}
            >
              <option value="">Choose a service</option>
              {(servicesQuery.data?.content ?? [])
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="With">
            <Select
              aria-label="Team member"
              value={staffProfileId}
              onChange={(e) => {
                setStaffProfileId(e.target.value);
                setSlot(null);
              }}
            >
              <option value="">Anyone available</option>
              {(staffQuery.data ?? [])
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        {serviceId && (
          <div className="space-y-4">
            <DateStrip
              value={date}
              timezone={timezone}
              daysToShow={5}
              onChange={(next) => {
                setDate(next);
                setSlot(null);
              }}
            />
            <SlotPicker
              slots={availabilityQuery.data?.slots ?? []}
              value={slot?.startsAt}
              loading={availabilityQuery.isLoading}
              onChange={setSlot}
              emptyMessage="No free times that day for this service."
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer name" required error={nameError ?? undefined}>
            {/* Required precisely because there may be no account behind this. */}
            <Input
              aria-label="Customer name"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setNameError(null);
              }}
            />
          </Field>
          <Field label="How they were taken">
            <Select
              aria-label="How the booking was taken"
              value={source}
              onChange={(e) => setSource(e.target.value as 'WALK_IN' | 'PHONE')}
            >
              <option value="WALK_IN">At the counter</option>
              <option value="PHONE">Over the phone</option>
            </Select>
          </Field>
          <Field label="Phone">
            <Input aria-label="Customer phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </Field>
          <Field label="Email" hint="Optional — needed if they want a confirmation">
            <Input aria-label="Customer email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          </Field>
        </div>

        <Field label="Note from the customer">
          <Textarea aria-label="Customer note" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="Private note" hint="Only your team sees this — never shown to the customer">
          <Textarea
            aria-label="Private note"
            rows={2}
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
