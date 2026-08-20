import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';

import { adminServiceCategories, adminServices } from '@/api/services';
import { ApiError } from '@/lib/http';
import { durationLabel, money } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useBookingsEntitlement } from '@/lib/useBookingsGate';
import { ServiceGalleryEditor } from '@/components/admin/ServiceGalleryEditor';
import type {
  AdminServiceOfferingResponse,
  CreateServiceOfferingRequest,
  ServiceImageRequest,
  UpdateServiceOfferingRequest,
} from '@/lib/types';
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Switch,
  Textarea,
  type Column,
} from '@/components/ui';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PAGE_SIZE = 20;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

interface FormState {
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  durationMinutes: string;
  bufferMinutes: string;
  images: ServiceImageRequest[];
  active: boolean;
  sortOrder: string;
  /** Empty string means "inherit the store's" — kept apart from "0", which is a
   *  real value for notice and cut-off. */
  minLeadTimeMinutes: string;
  maxAdvanceDays: string;
  maxConcurrentBookings: string;
  cancellationCutoffHours: string;
}

const EMPTY_FORM: FormState = {
  categoryId: '',
  name: '',
  slug: '',
  description: '',
  price: '',
  durationMinutes: '60',
  bufferMinutes: '0',
  images: [],
  active: true,
  sortOrder: '0',
  minLeadTimeMinutes: '',
  maxAdvanceDays: '',
  maxConcurrentBookings: '',
  cancellationCutoffHours: '',
};

function fromService(s: AdminServiceOfferingResponse): FormState {
  return {
    categoryId: s.categoryId ?? '',
    name: s.name,
    slug: s.slug,
    description: s.description ?? '',
    price: String(s.price),
    durationMinutes: String(s.durationMinutes),
    bufferMinutes: String(s.bufferMinutes),
    // An older payload carries only the single image; treat it as a gallery of one
    // so the editor has something to show and saving does not silently drop it.
    images:
      s.images && s.images.length > 0
        ? s.images.map((image) => ({ url: image.url, altText: image.altText ?? '' }))
        : s.imageUrl
          ? [{ url: s.imageUrl, altText: s.imageAltText ?? '' }]
          : [],
    active: s.active,
    sortOrder: String(s.sortOrder),
    minLeadTimeMinutes: s.minLeadTimeMinutes == null ? '' : String(s.minLeadTimeMinutes),
    maxAdvanceDays: s.maxAdvanceDays == null ? '' : String(s.maxAdvanceDays),
    maxConcurrentBookings: s.maxConcurrentBookings == null ? '' : String(s.maxConcurrentBookings),
    cancellationCutoffHours:
      s.cancellationCutoffHours == null ? '' : String(s.cancellationCutoffHours),
  };
}

/** Blank stays blank: null tells the server to inherit, where 0 would be a rule. */
function optionalNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

/**
 * The service menu, from the shop's side.
 *
 * Two numbers here decide what customers can book, and they are worth separating
 * clearly on the form: duration is what the customer is told and pays for, while
 * the buffer is private time the diary blocks afterwards for cleaning down and
 * writing up. A shop that puts its turnaround into the duration ends up quoting
 * eighty minutes for an hour's treatment.
 */
export default function AdminServices() {
  const qc = useQueryClient();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { bookingsAllowed, loading: entitlementLoading } = useBookingsEntitlement();

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminServiceOfferingResponse | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<AdminServiceOfferingResponse | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'service-categories'],
    queryFn: adminServiceCategories.list,
    enabled: bookingsAllowed,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'services', { search, categoryFilter, page }],
    queryFn: () =>
      adminServices.list({
        q: search || undefined,
        categoryId: categoryFilter || undefined,
        page,
        size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    enabled: bookingsAllowed,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'services'] });
    // The storefront reads a different list; a menu edit has to reach it too.
    qc.invalidateQueries({ queryKey: ['services'] });
  };

  function onMutationError(e: unknown, title: string) {
    if (e instanceof ApiError) {
      if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
      else if (e.code === 'SERVICE_SLUG_EXISTS') {
        setErrors({ slug: 'A service with this slug already exists.' });
      } else if (e.code === 'SERVICE_HAS_BOOKINGS') {
        // The history is the point: past appointments still refer to it.
        toast.error(
          'This service has bookings',
          'Switch it off instead of deleting it — appointments already in the diary refer to it.',
        );
        setDeleteTarget(null);
        return;
      }
      toast.error(title, e.message);
    } else {
      toast.error(title, 'An unexpected error occurred.');
    }
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateServiceOfferingRequest) => adminServices.create(body),
    onSuccess: () => {
      invalidate();
      toast.success('Service added');
      closeForm();
    },
    onError: (e) => onMutationError(e, 'Could not add the service'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateServiceOfferingRequest }) =>
      adminServices.update(id, body),
    onSuccess: () => {
      invalidate();
      toast.success('Service updated');
      closeForm();
    },
    onError: (e) => onMutationError(e, 'Could not update the service'),
  });

  /** Flipping bookable in place. It is a full-replace PUT like any other edit,
   *  so every field is sent back — with only `active` changed. */
  const toggleMutation = useMutation({
    mutationFn: (svc: AdminServiceOfferingResponse) =>
      adminServices.update(svc.id, {
        categoryId: svc.categoryId,
        name: svc.name,
        slug: svc.slug,
        description: svc.description,
        price: svc.price,
        durationMinutes: svc.durationMinutes,
        bufferMinutes: svc.bufferMinutes,
        imageUrl: svc.imageUrl,
        imageAltText: svc.imageAltText,
        sortOrder: svc.sortOrder,
        active: !svc.active,
      }),
    onSuccess: (updated) => {
      invalidate();
      toast.success(updated.active ? 'Now bookable' : 'Hidden from customers');
    },
    onError: (e) => onMutationError(e, 'Could not change that'),
  });

  const togglingId = toggleMutation.isPending ? toggleMutation.variables?.id : undefined;
  const toggleActive = (svc: AdminServiceOfferingResponse) => toggleMutation.mutate(svc);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminServices.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success('Service deleted');
    },
    onError: (e) => onMutationError(e, 'Could not delete the service'),
  });

  function openCreate() {
    setErrors({});
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setSlugTouched(false);
    setFormOpen(true);
  }

  function openEdit(s: AdminServiceOfferingResponse) {
    setErrors({});
    setEditTarget(s);
    setForm(fromService(s));
    setSlugTouched(true); // a live service's slug is a URL — never rewrite it silently
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
    setErrors({});
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.slug.trim()) next.slug = 'Slug is required';
    else if (!SLUG_RE.test(form.slug.trim())) next.slug = 'Use lowercase letters, digits and hyphens';
    const price = Number(form.price);
    if (form.price === '' || Number.isNaN(price) || price < 0) next.price = 'Enter a price';
    const duration = Number(form.durationMinutes);
    // Mirrors the server's own range, so a typo is caught before a round trip.
    if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
      next.durationMinutes = 'Between 5 and 480 minutes';
    }
    const buffer = Number(form.bufferMinutes);
    if (!Number.isInteger(buffer) || buffer < 0 || buffer > 120) {
      next.bufferMinutes = 'Between 0 and 120 minutes';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const base = {
      categoryId: form.categoryId || null,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      durationMinutes: Number(form.durationMinutes),
      // The gallery is the source of truth; the server mirrors its first entry
      // into imageUrl for the thumbnail, so neither is sent by hand.
      images: form.images.map((image) => ({ url: image.url, altText: image.altText?.trim() || null })),
      minLeadTimeMinutes: optionalNumber(form.minLeadTimeMinutes),
      maxAdvanceDays: optionalNumber(form.maxAdvanceDays),
      maxConcurrentBookings: optionalNumber(form.maxConcurrentBookings),
      cancellationCutoffHours: optionalNumber(form.cancellationCutoffHours),
    };
    if (editTarget) {
      // A full replace: the server keeps nothing it is not sent, so every field
      // the form loaded goes back even when it was not touched.
      updateMutation.mutate({
        id: editTarget.id,
        body: {
          ...base,
          bufferMinutes: Number(form.bufferMinutes),
          active: form.active,
          sortOrder: Number(form.sortOrder) || 0,
        },
      });
    } else {
      createMutation.mutate({
        ...base,
        bufferMinutes: Number(form.bufferMinutes),
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
      });
    }
  }

  const columns: Column<AdminServiceOfferingResponse>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Service',
        render: (s) => (
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => openEdit(s)}
              className="block max-w-full truncate rounded text-left font-medium text-slate-100 transition hover:text-gold-300"
            >
              {s.name}
            </button>
            {s.categoryName && <p className="truncate text-xs text-slate-500">{s.categoryName}</p>}
          </div>
        ),
      },
      { key: 'price', header: 'Price', render: (s) => money(s.price, s.currency) },
      {
        key: 'durationMinutes',
        header: 'Takes',
        render: (s) => (
          <span className="text-slate-300">
            {durationLabel(s.durationMinutes)}
            {/* Shown only when set, and always as a separate idea from duration. */}
            {s.bufferMinutes > 0 && (
              <span className="text-xs text-slate-500"> +{s.bufferMinutes}m turnaround</span>
            )}
          </span>
        ),
      },
      {
        key: 'active',
        header: 'Bookable',
        // A switch rather than a badge: whether customers can book this is the
        // single most-changed thing on this screen, and it was previously buried
        // three clicks deep inside the edit form.
        render: (s) => (
          <span onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={s.active}
            label={`${s.active ? 'Hide' : 'Show'} ${s.name}`}
            size="sm"
            disabled={togglingId === s.id}
            onChange={() => toggleActive(s)}
          />
          </span>
        ),
      },
    ],
    [togglingId],
  );

  if (entitlementLoading) return null;
  if (!bookingsAllowed) {
    return (
      <EmptyState
        icon={<Sparkles className="h-6 w-6" aria-hidden />}
        title="Bookings aren’t part of this store’s plan"
        message="Get in touch with us and we can switch appointments on for you."
      />
    );
  }

  const services = data?.content ?? [];

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle="What customers can book, how long it takes, and what it costs."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden /> Add service
          </Button>
        }
      />

      <Card className="p-4">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SearchInput defaultValue={search} onSearch={(v) => { setSearch(v); setPage(0); }} placeholder="Search services" />
          <Select
            aria-label="Filter by group"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
          >
            <option value="">All groups</option>
            {(categoriesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <p className="self-center text-right text-xs text-slate-500">
            {data ? `${data.totalElements} service${data.totalElements === 1 ? '' : 's'}` : ''}
          </p>
        </div>

        {isError ? (
          <EmptyState title="Could not load services" message="Please try again shortly." />
        ) : (
          <DataTable
            columns={columns}
            data={services}
            getRowKey={(s) => s.id}
            onRowClick={openEdit}
            loading={isLoading}
            empty={
              <EmptyState
                icon={<Sparkles className="h-6 w-6" aria-hidden />}
                title="No services yet"
                message="Add what you offer and customers will be able to book it."
                action={<Button onClick={openCreate}>Add service</Button>}
              />
            }
            rowActions={(s) => (
              <div className="flex justify-end gap-1">
                {/* Named, rather than relying on the row's title being a button —
                    an action nobody can see is an action nobody uses. */}
                <Button variant="ghost" size="sm" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}>
                  <Pencil className="h-4 w-4" aria-hidden /> Edit
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(s)} aria-label={`Delete ${s.name}`}>
                    <Trash2 className="h-4 w-4 text-danger-400" aria-hidden /> Delete
                  </Button>
                )}
              </div>
            )}
          />
        )}

        {(data?.totalPages ?? 0) > 1 && (
          <Pagination page={data?.number ?? 0} totalPages={data?.totalPages ?? 0} onChange={setPage} />
        )}
      </Card>

      {formOpen && (
        <Modal
          open
          onClose={closeForm}
          size="lg"
          title={editTarget ? 'Edit service' : 'Add service'}
          footer={
            <>
              <Button variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editTarget ? 'Save changes' : 'Add service'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Name" required error={errors.name}>
              <Input
                aria-label="Service name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) }))
                }
                placeholder="Deep tissue massage"
              />
            </Field>

            <Field label="Web address" hint="How it appears in the link customers share" error={errors.slug}>
              <Input
                aria-label="Slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set('slug', e.target.value);
                }}
              />
            </Field>

            <Field label="Group" hint="Optional — how the menu is divided up">
              <Select
                aria-label="Service group"
                value={form.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}
              >
                <option value="">No group</option>
                {(categoriesQuery.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Description">
              <Textarea
                aria-label="Description"
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Price" required error={errors.price}>
                <Input
                  aria-label="Price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                />
              </Field>
              <Field label="How long" hint="Minutes the customer is booked for" error={errors.durationMinutes}>
                <Input
                  aria-label="Duration in minutes"
                  type="number"
                  min={5}
                  max={480}
                  value={form.durationMinutes}
                  onChange={(e) => set('durationMinutes', e.target.value)}
                />
              </Field>
              <Field
                label="Turnaround"
                hint="Private time blocked after — never shown to customers"
                error={errors.bufferMinutes}
              >
                <Input
                  aria-label="Turnaround in minutes"
                  type="number"
                  min={0}
                  max={120}
                  value={form.bufferMinutes}
                  onChange={(e) => set('bufferMinutes', e.target.value)}
                />
              </Field>
            </div>

            {/* Generation offered here for the same reason it is on a category:
                a service has no photograph of its own to fall back on, and a
                merchant setting up at the counter rarely has one to hand. The
                service's name and group are what the prompt is drafted from, so
                filling those in first gives a better picture. */}
            <div>
              <h3 className="mb-2 text-body-sm font-medium text-slate-300">Pictures</h3>
              <ServiceGalleryEditor
                value={form.images}
                onChange={(next) => set('images', next)}
                serviceName={form.name}
                categoryName={categoriesQuery.data?.find((c) => c.id === form.categoryId)?.name}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Order in the menu" hint="Lower numbers come first">
                <Input
                  aria-label="Sort order"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => set('sortOrder', e.target.value)}
                />
              </Field>
              <div className="self-end pb-2">
                <Switch
                  checked={form.active}
                  onChange={(next) => set('active', next)}
                  label="Bookable"
                  description="Customers can book this"
                />
              </div>
            </div>

            {/* Rules that differ from the shop's. Empty means this service simply
                follows the store, so a merchant who never opens this section is
                not quietly pinned to today's numbers. */}
            <div className="rounded-xl border border-ink-700 p-4">
              <h3 className="text-body-sm font-medium text-slate-300">Booking rules for this service</h3>
              <p className="mt-1 text-caption text-slate-500">
                Leave a box empty to follow the shop's own setting. Fill one in only where this
                service is different — a treatment that needs a day's notice, or a room there is only
                one of.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Shortest notice" hint="Minutes. Empty = same as the shop">
                  <Input
                    aria-label="Notice in minutes for this service"
                    type="number"
                    min={0}
                    max={10080}
                    placeholder="Same as shop"
                    value={form.minLeadTimeMinutes}
                    onChange={(e) => set('minLeadTimeMinutes', e.target.value)}
                  />
                </Field>
                <Field label="Book up to" hint="Days ahead. Empty = same as the shop">
                  <Input
                    aria-label="Days ahead for this service"
                    type="number"
                    min={1}
                    max={365}
                    placeholder="Same as shop"
                    value={form.maxAdvanceDays}
                    onChange={(e) => set('maxAdvanceDays', e.target.value)}
                  />
                </Field>
                <Field
                  label="At the same time"
                  hint="How many of THIS service can overlap. The shop's own limit still applies"
                >
                  <Input
                    aria-label="Concurrent bookings for this service"
                    type="number"
                    min={1}
                    max={100}
                    placeholder="No extra limit"
                    value={form.maxConcurrentBookings}
                    onChange={(e) => set('maxConcurrentBookings', e.target.value)}
                  />
                </Field>
                <Field label="Changes close" hint="Hours before. Empty = same as the shop">
                  <Input
                    aria-label="Cancellation cutoff for this service"
                    type="number"
                    min={0}
                    max={336}
                    placeholder="Same as shop"
                    value={form.cancellationCutoffHours}
                    onChange={(e) => set('cancellationCutoffHours', e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? 'this service'}?`}
        description="If it has ever been booked the server will refuse — switch it off instead, which hides it from customers and keeps your records intact."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
