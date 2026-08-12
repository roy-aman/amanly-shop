import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GalleryHorizontalEnd, Pencil, Plus, Trash2 } from 'lucide-react';
import { adminBanners } from '@/api/banners';
import { ApiError } from '@/lib/http';
import type { BannerPlacement, BannerResponse, CreateBannerRequest } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  ImageWithFallback,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { RowsSkeleton } from '@/components/RouteSkeletons';

const PLACEMENTS: { value: BannerPlacement; label: string; help: string }[] = [
  { value: 'HOME_HERO', label: 'Home hero', help: 'The large banner at the top of the home page.' },
  { value: 'HOME_STRIP', label: 'Home strip', help: 'A slim announcement bar on the home page.' },
  { value: 'PLP_STRIP', label: 'Listing strip', help: 'A banner across the product listing page.' },
];

const PLACEMENT_LABEL: Record<BannerPlacement, string> = Object.fromEntries(
  PLACEMENTS.map((p) => [p.value, p.label]),
) as Record<BannerPlacement, string>;

interface FormState {
  placement: BannerPlacement;
  imageUrl: string;
  mobileImageUrl: string;
  altText: string;
  linkUrl: string;
  headline: string;
  subtext: string;
  ctaLabel: string;
  sortOrder: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
}

const EMPTY_FORM: FormState = {
  placement: 'HOME_HERO',
  imageUrl: '',
  mobileImageUrl: '',
  altText: '',
  linkUrl: '',
  headline: '',
  subtext: '',
  ctaLabel: '',
  sortOrder: '0',
  active: true,
  startsAt: '',
  endsAt: '',
};

/**
 * `datetime-local` speaks local wall-clock with no zone; the API speaks UTC
 * instants. Converting through `Date` is what makes "starts 28 Oct, 00:00" mean
 * midnight where the merchant is rather than midnight in UTC, which in India
 * would put the campaign live at half past five the previous morning.
 */
function toInstant(local: string): string | null {
  if (!local) return null;
  const parsed = new Date(local);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toLocalInput(instant: string | null): string {
  if (!instant) return '';
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  // Shift by the zone offset so `toISOString`'s UTC text reads as local time,
  // which is the only format the input accepts.
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toForm(banner: BannerResponse): FormState {
  return {
    placement: banner.placement,
    imageUrl: banner.imageUrl,
    mobileImageUrl: banner.mobileImageUrl ?? '',
    altText: banner.altText ?? '',
    linkUrl: banner.linkUrl ?? '',
    headline: banner.headline ?? '',
    subtext: banner.subtext ?? '',
    ctaLabel: banner.ctaLabel ?? '',
    sortOrder: String(banner.sortOrder),
    active: banner.active,
    startsAt: toLocalInput(banner.startsAt),
    endsAt: toLocalInput(banner.endsAt),
  };
}

function toRequest(form: FormState): CreateBannerRequest {
  const trimmed = (value: string) => value.trim() || null;
  return {
    placement: form.placement,
    imageUrl: form.imageUrl.trim(),
    mobileImageUrl: trimmed(form.mobileImageUrl),
    altText: trimmed(form.altText),
    linkUrl: trimmed(form.linkUrl),
    headline: trimmed(form.headline),
    subtext: trimmed(form.subtext),
    ctaLabel: trimmed(form.ctaLabel),
    sortOrder: Number(form.sortOrder) || 0,
    active: form.active,
    startsAt: toInstant(form.startsAt),
    endsAt: toInstant(form.endsAt),
  };
}

/**
 * Why a banner is or is not on the site.
 *
 * Three states rather than a single on/off, because "saved but not showing" has
 * two completely different causes and a merchant who cannot tell them apart
 * will either wait for a campaign that already ended or switch on one that was
 * deliberately scheduled.
 */
function StatusBadge({ banner }: { banner: BannerResponse }) {
  if (banner.live) return <Badge tone="green">Live</Badge>;
  if (!banner.active) return <Badge tone="gray">Off</Badge>;

  const now = Date.now();
  if (banner.startsAt && new Date(banner.startsAt).getTime() > now) {
    return <Badge tone="amber">Scheduled</Badge>;
  }
  if (banner.endsAt && new Date(banner.endsAt).getTime() <= now) {
    return <Badge tone="gray">Expired</Badge>;
  }
  return <Badge tone="gray">Not showing</Badge>;
}

function describeSchedule(banner: BannerResponse): string | null {
  const fmt = (value: string) => new Date(value).toLocaleString();
  if (banner.startsAt && banner.endsAt) return `${fmt(banner.startsAt)} → ${fmt(banner.endsAt)}`;
  if (banner.startsAt) return `From ${fmt(banner.startsAt)}`;
  if (banner.endsAt) return `Until ${fmt(banner.endsAt)}`;
  return null;
}

export default function Banners() {
  const qc = useQueryClient();
  const toast = useToast();
  const { isAdmin } = useAuth();

  const [placementFilter, setPlacementFilter] = useState<BannerPlacement | ''>('');
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'banners'],
    queryFn: () => adminBanners.list(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BannerResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BannerResponse | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'banners'] });

  function onMutationError(e: unknown, title: string) {
    if (e instanceof ApiError) {
      if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
      toast.error(title, e.message);
    } else {
      toast.error(title, 'An unexpected error occurred.');
    }
  }

  const createMutation = useMutation({
    mutationFn: () => adminBanners.create(toRequest(form)),
    onSuccess: () => {
      invalidate();
      toast.success('Banner created');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => onMutationError(e, 'Could not create'),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) => adminBanners.update(id, toRequest(form)),
    onSuccess: () => {
      invalidate();
      toast.success('Banner updated');
      setEditTarget(null);
    },
    onError: (e) => onMutationError(e, 'Could not update'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => adminBanners.setActive(id, active),
    onSuccess: (banner) => {
      invalidate();
      toast.success(banner.active ? 'Banner switched on' : 'Banner switched off');
    },
    onError: (e) => onMutationError(e, 'Could not update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminBanners.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Banner deleted');
      setDeleteTarget(null);
    },
    onError: (e) => onMutationError(e, 'Could not delete'),
  });

  const banners = useMemo(
    () => (data ?? []).filter((b) => !placementFilter || b.placement === placementFilter),
    [data, placementFilter],
  );

  function openCreate() {
    setErrors({});
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openEdit(banner: BannerResponse) {
    setErrors({});
    setForm(toForm(banner));
    setEditTarget(banner);
  }

  const canSave = form.imageUrl.trim().length > 0;

  const formFields = (
    <div className="space-y-4">
      <Field label="Placement" required error={errors.placement}>
        <Select
          value={form.placement}
          onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value as BannerPlacement }))}
        >
          {PLACEMENTS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-slate-500">
          {PLACEMENTS.find((p) => p.value === form.placement)?.help}
        </p>
      </Field>

      <ImageUploadField
        label="Image"
        required
        value={form.imageUrl}
        onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
        error={errors.imageUrl}
      />

      <ImageUploadField
        label="Mobile image"
        value={form.mobileImageUrl}
        onChange={(url) => setForm((f) => ({ ...f, mobileImageUrl: url }))}
        hint="Optional narrow crop. A wide hero cropped to a phone usually cuts the subject out."
        error={errors.mobileImageUrl}
      />

      <Field
        label="Alt text"
        hint="Describes the image for screen readers and when it fails to load."
        error={errors.altText}
      >
        <Input value={form.altText} onChange={(e) => setForm((f) => ({ ...f, altText: e.target.value }))} />
      </Field>

      <Field label="Link" hint="Where a tap goes, e.g. /products?tag=sale. Optional." error={errors.linkUrl}>
        <Input
          value={form.linkUrl}
          onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
          invalid={!!errors.linkUrl}
        />
      </Field>

      <Field
        label="Headline"
        hint="Rendered over the image. Text kept out of the artwork stays readable on a narrow screen and can be read aloud."
        error={errors.headline}
      >
        <Input value={form.headline} onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} />
      </Field>

      <Field label="Subtext" error={errors.subtext}>
        <Textarea
          rows={2}
          value={form.subtext}
          onChange={(e) => setForm((f) => ({ ...f, subtext: e.target.value }))}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Button label" error={errors.ctaLabel}>
          <Input value={form.ctaLabel} onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))} />
        </Field>
        <Field label="Sort order" hint="Lower shows first." error={errors.sortOrder}>
          <Input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" hint="Leave empty to show as soon as it is on." error={errors.startsAt}>
          <Input
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
          />
        </Field>
        <Field label="Ends" hint="Leave empty to run until switched off." error={errors.endsAt}>
          <Input
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
            invalid={!!errors.endsAt}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
        />
        Switched on
      </label>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Banners"
        subtitle="Artwork shown on the storefront. Schedule a campaign ahead and it goes up on its own."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New banner
          </Button>
        }
      />

      <Card className="p-4">
        <div className="mb-4 max-w-xs">
          <Select
            aria-label="Filter by placement"
            value={placementFilter}
            onChange={(e) => setPlacementFilter(e.target.value as BannerPlacement | '')}
          >
            <option value="">All placements</option>
            {PLACEMENTS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>

        {isLoading ? (
          <RowsSkeleton rows={4} />
        ) : isError ? (
          <EmptyState title="Could not load banners" message={(error as Error)?.message} />
        ) : banners.length === 0 ? (
          <EmptyState
            icon={<GalleryHorizontalEnd className="h-10 w-10" />}
            title="No banners yet"
            message="Add one to put artwork on the storefront."
          />
        ) : (
          <ul className="divide-y divide-ink-800">
            {banners.map((banner) => {
              const schedule = describeSchedule(banner);
              return (
                <li key={banner.id} className="flex items-center gap-4 py-3">
                  <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
                    <ImageWithFallback
                      src={banner.imageUrl}
                      alt={banner.altText ?? ''}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-100">
                        {banner.headline || banner.altText || 'Untitled banner'}
                      </span>
                      <StatusBadge banner={banner} />
                      <Badge tone="gray">{PLACEMENT_LABEL[banner.placement]}</Badge>
                    </div>
                    {schedule && <p className="mt-0.5 text-xs text-slate-500">{schedule}</p>}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={toggleMutation.isPending && toggleMutation.variables?.id === banner.id}
                      onClick={() => toggleMutation.mutate({ id: banner.id, active: !banner.active })}
                    >
                      {banner.active ? 'Switch off' : 'Switch on'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(banner)}
                      aria-label={`Edit ${banner.headline ?? 'banner'}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(banner)}
                        aria-label={`Delete ${banner.headline ?? 'banner'}`}
                      >
                        <Trash2 className="h-4 w-4 text-rose-400" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New banner"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={createMutation.isPending} disabled={!canSave} onClick={() => createMutation.mutate()}>
              Create
            </Button>
          </>
        }
      >
        {formFields}
      </Modal>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit banner"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              loading={updateMutation.isPending}
              disabled={!canSave}
              onClick={() => editTarget && updateMutation.mutate(editTarget.id)}
            >
              Save
            </Button>
          </>
        }
      >
        {formFields}
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete banner?"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-400">
          This removes the banner from the storefront immediately. To take it down temporarily, switch it off
          instead — that keeps the dates it was booked for.
        </p>
      </Modal>
    </div>
  );
}
