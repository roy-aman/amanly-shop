import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CalendarCheck, CalendarPlus, Clock, Download, MapPin } from 'lucide-react';

import { getAvailability, getService } from '@/api/services';
import { listStaff } from '@/api/staff';
import { downloadBookingIcs, placeBooking } from '@/api/bookings';
import { ApiError } from '@/lib/http';
import { durationLabel, formatDateTimeInZone, money, zonedToday } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useBookingsEnabled } from '@/lib/useBookingsGate';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { AvailabilitySlot, BookingResponse } from '@/lib/types';
import {
  Button,
  Card,
  DateStrip,
  Field,
  Input,
  SlotPicker,
  Stepper,
  Textarea,
  type Step,
} from '@/components/ui';
import { InfoRow, SummarySection } from '@/components/summary';
import { FormSkeleton } from '@/components/RouteSkeletons';
import NotFound from '@/pages/NotFound';

const STEPS: Step[] = [
  { label: 'Time', description: 'Pick a slot' },
  { label: 'Details', description: 'How to reach you' },
  { label: 'Confirm', description: 'Check and book' },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Booking, in three steps.
 *
 * Public until the last one. Asking someone to sign in before they know whether
 * you have a Thursday evening free is how a booking flow loses people, so the
 * prompt comes after the slot is chosen — which creates the problem this page is
 * really built around: the sign-in round trip must not cost the customer their
 * choice.
 *
 * The answer is that the wizard's state lives in the URL. Sign-in returns
 * through `location.state.from`, which is a path, so the service, date, time and
 * staff travel as query parameters and the page rebuilds itself on the way back.
 * If the slot has gone in the meantime — someone else booked it while they were
 * typing a password — the picker reopens on that date and says so, rather than
 * silently landing on a different time.
 *
 * Nothing here computes a time. The picker offers what the server said was free,
 * and the chosen slot's `startsAt` is posted back exactly as it arrived.
 */
export default function BookService() {
  const { slug = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const toast = useToast();
  const { isAuthenticated } = useAuth();
  const { enabled, loading: gateLoading, timezone, businessAddress } = useBookingsEnabled();

  const serviceQuery = useQuery({
    queryKey: ['service', slug],
    queryFn: () => getService(slug),
    enabled: enabled && !!slug,
  });
  const service = serviceQuery.data;
  useDocumentTitle(service ? `Book ${service.name}` : 'Book');

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: listStaff,
    staleTime: 5 * 60_000,
    enabled,
  });

  // ── Wizard state, mirrored to the URL so it survives a sign-in ──────────
  const urlDate = searchParams.get('date');
  const date = urlDate && ISO_DATE.test(urlDate) ? urlDate : zonedToday(timezone);
  const staffId = searchParams.get('staff') ?? '';
  const wantedStart = searchParams.get('start') ?? '';

  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [slotLost, setSlotLost] = useState(false);
  const [booked, setBooked] = useState<BookingResponse | null>(null);

  const patchUrl = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next, { replace: true });
  };

  const availabilityQuery = useQuery({
    queryKey: ['availability', service?.id, date, staffId || 'any'],
    queryFn: () => getAvailability(service!.id, date, staffId || undefined),
    enabled: enabled && !!service?.id,
    // Availability is the one thing here with a short shelf life: a slot list is
    // a promise the server never made past the moment it answered. Seconds
    // rather than the app-wide 30, and refreshed when the tab is looked at
    // again, because a customer who left this open over lunch is exactly who
    // walks into a 409.
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const slots = useMemo(() => availabilityQuery.data?.slots ?? [], [availabilityQuery.data]);
  // Availability answers with its own zone; before it lands, the store's will do.
  const zone = availabilityQuery.data?.timezone ?? timezone;

  // Restore a slot named in the URL — the return leg of a sign-in.
  useEffect(() => {
    if (!wantedStart || selected?.startsAt === wantedStart || availabilityQuery.isLoading) return;
    const match = slots.find((s) => s.startsAt === wantedStart);
    if (match) {
      setSelected(match);
      setSlotLost(false);
    } else if (slots.length > 0 || availabilityQuery.isSuccess) {
      // Gone while they were away. Say so rather than quietly choosing another.
      setSelected(null);
      setSlotLost(true);
      patchUrl({ start: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedStart, slots, availabilityQuery.isLoading, availabilityQuery.isSuccess]);

  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [step]);

  const bookMutation = useMutation({
    mutationFn: () =>
      placeBooking({
        serviceOfferingId: service!.id,
        // Exactly the string the server offered. Not reformatted, not rebuilt.
        startsAt: selected!.startsAt,
        staffProfileId: staffId || undefined,
        customerPhone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (booking) => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['availability'] });
      setBooked(booking);
    },
    onError: (e) => {
      if (!(e instanceof ApiError)) {
        toast.error('Could not book', 'Please try again.');
        return;
      }
      // Someone else took it between render and submit. Refresh and let them
      // choose again — booking a different time on their behalf is worse than
      // asking, and retrying automatically does exactly that.
      if (e.code === 'SLOT_NO_LONGER_AVAILABLE') {
        qc.invalidateQueries({ queryKey: ['availability'] });
        setSelected(null);
        setSlotLost(true);
        setStep(0);
        patchUrl({ start: '' });
        return;
      }
      // The shop's rules moved under us — a time that was inside the window when
      // the page loaded may not be now. Ask the server again rather than nudging
      // the time by hand.
      if (e.code === 'BOOKING_OUTSIDE_RULES') {
        qc.invalidateQueries({ queryKey: ['availability'] });
        setSelected(null);
        setStep(0);
        toast.error('That time is no longer bookable', e.message);
        return;
      }
      if (e.status === 401) {
        navigate('/login', { state: { from: location.pathname + location.search } });
        return;
      }
      toast.error('Could not book', e.message);
    },
  });

  if (gateLoading || serviceQuery.isLoading) return <FormSkeleton />;
  if (!enabled || serviceQuery.isError || !service) return <NotFound />;

  // ── Booked ─────────────────────────────────────────────────────────────
  if (booked) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-success-500/15 text-success-300">
            <CalendarCheck className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-5 text-display-sm font-semibold text-slate-100">You’re booked in</h1>
          {/* The reference they will quote on the phone, so it is the biggest
              thing on the page after the confirmation itself. */}
          <p className="mt-2 text-body text-slate-400">
            Your booking number is{' '}
            <span className="font-semibold tabular-nums text-slate-100">{booked.bookingNumber}</span>
          </p>
        </div>

        <Card className="mt-8 p-6">
          <dl>
            <InfoRow label="Service">{booked.serviceName}</InfoRow>
            <InfoRow label="When">{formatDateTimeInZone(booked.startsAt, zone)}</InfoRow>
            <InfoRow label="How long">{durationLabel(booked.durationMinutes)}</InfoRow>
            <InfoRow label="With">{booked.staffName ?? 'Whoever is free'}</InfoRow>
            <InfoRow label="To pay at the venue">{money(booked.price, booked.currency)}</InfoRow>
          </dl>
          {businessAddress && (
            <p className="mt-4 flex items-start gap-2 border-t border-ink-700 pt-4 text-body-sm text-slate-400">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="whitespace-pre-line">{businessAddress}</span>
            </p>
          )}
        </Card>

        <div className="mt-6 flex flex-wrap gap-3">
          {/* A plain anchor: this link needs no authentication, which is exactly
              why it is preferred over the .ics file below. */}
          <a
            href={booked.googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-4 py-2.5 text-body-sm font-medium text-slate-200 transition hover:border-slate-100"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden /> Add to Google Calendar
          </a>
          <Button
            variant="outline"
            onClick={() =>
              downloadBookingIcs(booked.id, booked.bookingNumber).catch(() =>
                toast.error('Download failed', 'The calendar file could not be produced.'),
              )
            }
          >
            <Download className="h-4 w-4" aria-hidden /> Download for another calendar
          </Button>
        </div>

        <p className="mt-6 text-body-sm text-slate-400">
          We have emailed you the details, and we will send a reminder before the day.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => navigate(`/account/bookings/${booked.id}`)}>View this booking</Button>
          <Link to="/services" className="rc-link self-center text-body-sm">
            Book something else
          </Link>
        </div>
      </div>
    );
  }

  const canContinueFromTime = selected != null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="mb-4 text-body-sm text-slate-400">
        <Link to={`/services/${service.slug}`} className="rc-link">
          {service.name}
        </Link>
        <span className="mx-2 text-slate-600">/</span>
        <span className="text-slate-300">Book</span>
      </nav>

      <h1 className="text-display-sm font-semibold text-slate-100">Book {service.name}</h1>
      <Stepper steps={STEPS} current={step} className="mt-8 max-w-2xl" />

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          {/* ── Step 1: when ──────────────────────────────────────────── */}
          {step === 0 && (
            <section>
              <h2 ref={stepHeadingRef} tabIndex={-1} className="text-h4 text-slate-100 outline-none">
                Pick a time
              </h2>

              {slotLost && (
                <p
                  role="status"
                  className="mt-4 flex items-start gap-2 rounded-lg border border-warning-500/30 bg-warning-500/10 px-3 py-2.5 text-body-sm text-warning-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  That time was taken just before you confirmed. Here is what is still free.
                </p>
              )}

              {staffQuery.data && staffQuery.data.length > 0 && (
                <div className="mt-6">
                  <Field label="Who with" hint="Leaving this open usually means more times to choose from">
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Who with">
                      {/* "Anyone" first and selected by default: it asks the
                          server "can anybody do this", which is a wider question
                          than any one person's diary. */}
                      <button
                        type="button"
                        role="radio"
                        aria-checked={!staffId}
                        onClick={() => {
                          patchUrl({ staff: '' });
                          setSelected(null);
                        }}
                        className={chipClass(!staffId)}
                      >
                        Anyone available
                      </button>
                      {staffQuery.data.map((person) => (
                        <button
                          key={person.id}
                          type="button"
                          role="radio"
                          aria-checked={staffId === person.id}
                          onClick={() => {
                            patchUrl({ staff: person.id });
                            setSelected(null);
                          }}
                          className={chipClass(staffId === person.id)}
                        >
                          {person.displayName}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              )}

              <div className="mt-6">
                <h3 className="mb-3 text-body-sm font-medium text-slate-300">Which day</h3>
                <DateStrip
                  value={date}
                  timezone={timezone}
                  onChange={(next) => {
                    patchUrl({ date: next, start: '' });
                    setSelected(null);
                    setSlotLost(false);
                  }}
                />
              </div>

              <div className="mt-8">
                <h3 className="mb-3 text-body-sm font-medium text-slate-300">
                  What time <span className="font-normal text-slate-500">(shown in the shop’s local time)</span>
                </h3>
                <SlotPicker
                  slots={slots}
                  value={selected?.startsAt}
                  loading={availabilityQuery.isLoading}
                  onChange={(slot) => {
                    setSelected(slot);
                    setSlotLost(false);
                    patchUrl({ start: slot.startsAt });
                  }}
                />
              </div>

              <div className="mt-8">
                <Button size="lg" disabled={!canContinueFromTime} onClick={() => setStep(1)}>
                  Continue
                </Button>
              </div>
            </section>
          )}

          {/* ── Step 2: who ───────────────────────────────────────────── */}
          {step === 1 && (
            <section>
              <h2 ref={stepHeadingRef} tabIndex={-1} className="text-h4 text-slate-100 outline-none">
                Your details
              </h2>
              <p className="mt-2 text-body-sm text-slate-400">
                We already have your name from your account. These are optional.
              </p>

              <div className="mt-6 max-w-md space-y-5">
                <Field label="Phone number" hint="So we can reach you if something changes">
                  {/* Field renders its label without htmlFor, so every control
                      inside one needs to name itself. */}
                  <Input
                    aria-label="Phone number"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </Field>
                <Field label="Anything we should know" hint="Optional">
                  <Textarea
                    aria-label="Anything we should know"
                    rows={3}
                    maxLength={1000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Allergies, preferences, or anything else"
                  />
                </Field>
              </div>

              <div className="mt-8 flex gap-3">
                <Button variant="outline" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button size="lg" onClick={() => setStep(2)}>
                  Continue
                </Button>
              </div>
            </section>
          )}

          {/* ── Step 3: confirm ───────────────────────────────────────── */}
          {step === 2 && selected && (
            <section>
              <h2 ref={stepHeadingRef} tabIndex={-1} className="text-h4 text-slate-100 outline-none">
                Check and confirm
              </h2>

              <Card className="mt-6 p-6">
                <dl>
                  <InfoRow label="Service">{service.name}</InfoRow>
                  <InfoRow label="When">{formatDateTimeInZone(selected.startsAt, zone)}</InfoRow>
                  <InfoRow label="How long">{durationLabel(service.durationMinutes)}</InfoRow>
                  <InfoRow label="With">
                    {staffQuery.data?.find((p) => p.id === staffId)?.displayName ?? 'Whoever is free'}
                  </InfoRow>
                  {phone.trim() && <InfoRow label="Phone">{phone.trim()}</InfoRow>}
                </dl>
              </Card>

              {/* Said plainly, twice, and never as "payment pending": a customer
                  who expects a payment step and does not find one assumes the
                  booking did not go through. */}
              <p className="mt-5 rounded-lg border border-ink-700 bg-ink-850/60 px-4 py-3 text-body-sm text-slate-300">
                Nothing to pay now — {money(service.price, service.currency)} is settled at the venue.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                {isAuthenticated ? (
                  <Button size="lg" loading={bookMutation.isPending} onClick={() => bookMutation.mutate()}>
                    Confirm booking — pay at venue
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={() =>
                      // The chosen slot is already in the URL, so `from` carries
                      // it back and nobody has to pick a time twice.
                      navigate('/login', { state: { from: location.pathname + location.search } })
                    }
                  >
                    Sign in to confirm
                  </Button>
                )}
              </div>
              {!isAuthenticated && (
                <p className="mt-3 text-caption text-slate-500">
                  We will bring you straight back here with this time held in place.
                </p>
              )}
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <SummarySection title="Your booking">
            <dl>
              <InfoRow label="Service">{service.name}</InfoRow>
              <InfoRow label="Price">{money(service.price, service.currency)}</InfoRow>
              <InfoRow label="How long">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                  {durationLabel(service.durationMinutes)}
                </span>
              </InfoRow>
              {selected && <InfoRow label="When">{formatDateTimeInZone(selected.startsAt, zone)}</InfoRow>}
            </dl>
          </SummarySection>
        </aside>
      </div>
    </div>
  );
}

function chipClass(selected: boolean): string {
  return [
    'rounded-full border px-3.5 py-1.5 text-sm font-medium transition duration-200 ease-emphasized active:scale-95',
    selected
      ? 'border-primary bg-primary text-primary-fg shadow-sm'
      : 'border-ink-600 bg-ink-850 text-slate-300 hover:border-slate-100 hover:text-slate-100',
  ].join(' ');
}
