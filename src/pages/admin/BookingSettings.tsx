import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCog } from 'lucide-react';

import { adminBookingSettings } from '@/api/bookings';
import { ApiError } from '@/lib/http';
import { useToast } from '@/context/ToastContext';
import type { BookingSettingsResponse, BusinessHoursEntry, UpdateBookingSettingsRequest } from '@/lib/types';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';
import { FormSkeleton } from '@/components/RouteSkeletons';
import { BusinessHoursEditor } from '@/components/admin/BusinessHoursEditor';

/** Offered where the browser can enumerate zones; otherwise the field falls back
 *  to free text with the current value, which is better than a short hardcoded
 *  list that omits the merchant's own. */
function supportedTimeZones(): string[] | null {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  if (typeof supported !== 'function') return null;
  try {
    return supported('timeZone');
  } catch {
    return null;
  }
}

interface FormState {
  bookingsEnabled: boolean;
  timezone: string;
  businessAddress: string;
  slotGranularityMinutes: string;
  maxConcurrentBookings: string;
  minLeadTimeMinutes: string;
  maxAdvanceDays: string;
  cancellationCutoffHours: string;
  reminderHoursBeforeFirst: string;
  reminderHoursBeforeSecond: string;
  whatsappConfirmationTemplate: string;
  whatsappReminderTemplate: string;
  businessHours: BusinessHoursEntry[];
}

function fromSettings(s: BookingSettingsResponse): FormState {
  return {
    bookingsEnabled: s.bookingsEnabled,
    timezone: s.timezone,
    businessAddress: s.businessAddress ?? '',
    slotGranularityMinutes: String(s.slotGranularityMinutes),
    maxConcurrentBookings: String(s.maxConcurrentBookings),
    minLeadTimeMinutes: String(s.minLeadTimeMinutes),
    maxAdvanceDays: String(s.maxAdvanceDays),
    cancellationCutoffHours: String(s.cancellationCutoffHours),
    reminderHoursBeforeFirst: s.reminderHoursBeforeFirst == null ? '' : String(s.reminderHoursBeforeFirst),
    reminderHoursBeforeSecond: s.reminderHoursBeforeSecond == null ? '' : String(s.reminderHoursBeforeSecond),
    whatsappConfirmationTemplate: s.whatsappConfirmationTemplate ?? '',
    whatsappReminderTemplate: s.whatsappReminderTemplate ?? '',
    businessHours: s.businessHours,
  };
}

/**
 * Everything that governs the diary, on one screen.
 *
 * This is a FULL REPLACE: whatever is submitted becomes the shop's entire
 * schedule, opening hours included, and nothing that is left out survives. So
 * the form cannot exist before its data does — saving is impossible until the
 * current settings have loaded, or a save would write an empty week and shut the
 * shop.
 *
 * The screen has three states, and keeping them apart is the point. Without the
 * platform entitlement there is nothing here to change and no toggle would help,
 * so it says so and stops. Entitled but switched off is a working setup screen
 * with a banner — that is a merchant who has work to finish, not a problem. On
 * and running is the plain form.
 */
export default function BookingSettings() {
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const zones = supportedTimeZones();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'booking-settings'],
    queryFn: adminBookingSettings.get,
  });

  // The form mirrors the server's answer once, and is the source of truth from
  // then on — refetching underneath an open form would discard someone's edits.
  useEffect(() => {
    if (data && form === null) setForm(fromSettings(data));
  }, [data, form]);

  const saveMutation = useMutation({
    mutationFn: (body: UpdateBookingSettingsRequest) => adminBookingSettings.update(body),
    onSuccess: (saved) => {
      setForm(fromSettings(saved));
      qc.invalidateQueries({ queryKey: ['admin', 'booking-settings'] });
      // The switch here decides whether the storefront shows a services surface
      // at all, and the console's own nav reads the same flags.
      qc.invalidateQueries({ queryKey: ['admin', 'store'] });
      qc.invalidateQueries({ queryKey: ['public-store'] });
      qc.invalidateQueries({ queryKey: ['business-hours'] });
      qc.invalidateQueries({ queryKey: ['availability'] });
      toast.success('Booking setup saved');
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
        toast.error('Could not save', e.message);
      } else {
        toast.error('Could not save', 'Please try again.');
      }
    },
  });

  if (isLoading) return <FormSkeleton fields={8} />;
  if (isError || !data) {
    return <EmptyState title="Could not load booking setup" message="Please try again shortly." />;
  }

  // No entitlement: a conversation with us, not a switch the merchant owns.
  if (!data.bookingsAllowed) {
    return (
      <EmptyState
        icon={<CalendarCog className="h-6 w-6" aria-hidden />}
        title="Bookings aren’t part of this store’s plan"
        message="Get in touch and we can switch appointments on for you."
      />
    );
  }

  if (!form) return <FormSkeleton fields={8} />;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  function validate(f: FormState): Record<string, string> {
    const next: Record<string, string> = {};
    const range = (key: keyof FormState, min: number, max: number, label: string) => {
      const n = Number(f[key]);
      if (!Number.isInteger(n) || n < min || n > max) next[key as string] = `${label} (${min}–${max})`;
    };
    // Mirrors the server's own ranges so a typo is caught before a round trip.
    range('slotGranularityMinutes', 5, 120, 'Minutes');
    range('maxConcurrentBookings', 1, 100, 'People at once');
    range('minLeadTimeMinutes', 0, 10080, 'Minutes');
    range('maxAdvanceDays', 1, 365, 'Days');
    range('cancellationCutoffHours', 0, 336, 'Hours');
    if (!f.timezone.trim()) next.timezone = 'A time zone is required';

    const first = f.reminderHoursBeforeFirst === '' ? null : Number(f.reminderHoursBeforeFirst);
    const second = f.reminderHoursBeforeSecond === '' ? null : Number(f.reminderHoursBeforeSecond);
    if (first != null && second != null && second >= first) {
      next.reminderHoursBeforeSecond = 'The second reminder has to be closer to the appointment';
    }
    return next;
  }

  function submit() {
    if (!form) return;
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Everything goes, every time — the server keeps nothing it is not sent.
    saveMutation.mutate({
      bookingsEnabled: form.bookingsEnabled,
      timezone: form.timezone.trim(),
      businessAddress: form.businessAddress.trim() || null,
      slotGranularityMinutes: Number(form.slotGranularityMinutes),
      maxConcurrentBookings: Number(form.maxConcurrentBookings),
      minLeadTimeMinutes: Number(form.minLeadTimeMinutes),
      maxAdvanceDays: Number(form.maxAdvanceDays),
      cancellationCutoffHours: Number(form.cancellationCutoffHours),
      reminderHoursBeforeFirst:
        form.reminderHoursBeforeFirst === '' ? null : Number(form.reminderHoursBeforeFirst),
      reminderHoursBeforeSecond:
        form.reminderHoursBeforeSecond === '' ? null : Number(form.reminderHoursBeforeSecond),
      whatsappConfirmationTemplate: form.whatsappConfirmationTemplate.trim() || null,
      whatsappReminderTemplate: form.whatsappReminderTemplate.trim() || null,
      businessHours: form.businessHours,
    });
  }

  return (
    <div>
      <PageHeader
        title="Booking setup"
        subtitle="Opening hours, how far ahead people can book, and when reminders go out."
        action={
          <Button onClick={submit} loading={saveMutation.isPending}>
            Save changes
          </Button>
        }
      />

      {!form.bookingsEnabled && (
        <p className="mb-6 rounded-lg border border-warning-500/30 bg-warning-500/10 px-4 py-3 text-body-sm text-warning-300">
          Bookings are switched off, so customers cannot see your services or book anything. Set
          everything up here, then turn them on when you are ready.
        </p>
      )}

      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-h5 text-slate-100">Taking bookings</h2>
          <label className="mt-4 flex items-center gap-3 text-body-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.bookingsEnabled}
              onChange={(e) => set('bookingsEnabled', e.target.checked)}
              aria-label="Accept bookings"
              className="h-4 w-4 rounded border-ink-600"
            />
            Customers can see services and book them
          </label>
        </Card>

        <Card className="p-6">
          <h2 className="text-h5 text-slate-100">Where and when</h2>
          <div className="mt-4 space-y-4">
            <Field label="Time zone" required error={errors.timezone} hint="Every appointment time is shown in this zone">
              {zones ? (
                <Select aria-label="Time zone" value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input aria-label="Time zone" value={form.timezone} onChange={(e) => set('timezone', e.target.value)} />
              )}
            </Field>

            <Field label="Address" hint="Shown on confirmations and added to calendar entries">
              <Textarea
                aria-label="Business address"
                rows={2}
                value={form.businessAddress}
                onChange={(e) => set('businessAddress', e.target.value)}
              />
            </Field>

            <div>
              <h3 className="mb-2 text-body-sm font-medium text-slate-300">Opening hours</h3>
              <BusinessHoursEditor value={form.businessHours} onChange={(next) => set('businessHours', next)} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-h5 text-slate-100">How booking works</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Times offered every"
              hint="Minutes between the start times customers see"
              error={errors.slotGranularityMinutes}
            >
              <Input
                aria-label="Slot granularity in minutes"
                type="number"
                min={5}
                max={120}
                value={form.slotGranularityMinutes}
                onChange={(e) => set('slotGranularityMinutes', e.target.value)}
              />
            </Field>
            <Field
              label="People at once"
              hint="How many appointments can run at the same time"
              error={errors.maxConcurrentBookings}
            >
              <Input
                aria-label="Maximum concurrent bookings"
                type="number"
                min={1}
                max={100}
                value={form.maxConcurrentBookings}
                onChange={(e) => set('maxConcurrentBookings', e.target.value)}
              />
            </Field>
            <Field
              label="Shortest notice"
              hint="Minutes ahead a customer must book"
              error={errors.minLeadTimeMinutes}
            >
              <Input
                aria-label="Minimum lead time in minutes"
                type="number"
                min={0}
                max={10080}
                value={form.minLeadTimeMinutes}
                onChange={(e) => set('minLeadTimeMinutes', e.target.value)}
              />
            </Field>
            <Field label="Book up to" hint="Days ahead" error={errors.maxAdvanceDays}>
              <Input
                aria-label="Maximum days in advance"
                type="number"
                min={1}
                max={365}
                value={form.maxAdvanceDays}
                onChange={(e) => set('maxAdvanceDays', e.target.value)}
              />
            </Field>
            <Field
              label="Changes close"
              hint="Hours before the appointment when customers can no longer change it online"
              error={errors.cancellationCutoffHours}
            >
              <Input
                aria-label="Cancellation cutoff in hours"
                type="number"
                min={0}
                max={336}
                value={form.cancellationCutoffHours}
                onChange={(e) => set('cancellationCutoffHours', e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-h5 text-slate-100">Reminders</h2>
          <p className="mt-1 text-body-sm text-slate-400">
            Sent by email automatically. Leave a box empty to switch that reminder off.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First reminder" hint="Hours before">
              <Input
                aria-label="First reminder hours before"
                type="number"
                min={1}
                max={168}
                value={form.reminderHoursBeforeFirst}
                onChange={(e) => set('reminderHoursBeforeFirst', e.target.value)}
              />
            </Field>
            <Field label="Second reminder" hint="Hours before" error={errors.reminderHoursBeforeSecond}>
              <Input
                aria-label="Second reminder hours before"
                type="number"
                min={1}
                max={168}
                value={form.reminderHoursBeforeSecond}
                onChange={(e) => set('reminderHoursBeforeSecond', e.target.value)}
              />
            </Field>
          </div>

          <div className="mt-6 border-t border-ink-700 pt-6">
            <h3 className="text-body-sm font-medium text-slate-300">WhatsApp</h3>
            {/* Stated plainly: without approved template names nothing is sent,
                and silence is otherwise indistinguishable from a broken feature. */}
            <p className="mt-1 text-caption text-slate-500">
              WhatsApp messages only go out once you have template names approved by Meta. Until then
              email is the only channel, and leaving these empty is fine.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Confirmation template">
                <Input
                  aria-label="WhatsApp confirmation template"
                  value={form.whatsappConfirmationTemplate}
                  onChange={(e) => set('whatsappConfirmationTemplate', e.target.value)}
                />
              </Field>
              <Field label="Reminder template">
                <Input
                  aria-label="WhatsApp reminder template"
                  value={form.whatsappReminderTemplate}
                  onChange={(e) => set('whatsappReminderTemplate', e.target.value)}
                />
              </Field>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" onClick={submit} loading={saveMutation.isPending}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
