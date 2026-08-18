import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, PowerOff, Tags } from 'lucide-react';
import { adminBrands } from '@/api/admin';
import { ApiError } from '@/lib/http';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import type { BrandResponse, CreateBrandRequest, UpdateBrandRequest } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Textarea,
  type Column,
} from '@/components/ui';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

interface BrandFormState {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  active: boolean;
}

const EMPTY_FORM: BrandFormState = { name: '', slug: '', description: '', logoUrl: '', active: true };

function fromBrand(b: BrandResponse): BrandFormState {
  return {
    name: b.name,
    slug: b.slug,
    description: b.description ?? '',
    logoUrl: b.logoUrl ?? '',
    active: b.active,
  };
}

export default function Brands() {
  const qc = useQueryClient();
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BrandResponse | null>(null);
  const [form, setForm] = useState<BrandFormState>({ ...EMPTY_FORM });
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deactivateTarget, setDeactivateTarget] = useState<BrandResponse | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: () => adminBrands.list(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'brands'] });

  function onMutationError(e: unknown, title: string) {
    if (e instanceof ApiError) {
      if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
      else if (e.code === 'BRAND_SLUG_EXISTS' || e.status === 409) {
        setErrors({ slug: 'A brand with this slug already exists.' });
      }
      toast.error(title, e.message);
    } else {
      toast.error(title, 'An unexpected error occurred.');
    }
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateBrandRequest) => adminBrands.create(body),
    onSuccess: () => {
      invalidate();
      toast.success('Brand created');
      closeForm();
    },
    onError: (e) => onMutationError(e, 'Could not create brand'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBrandRequest }) => adminBrands.update(id, body),
    onSuccess: () => {
      invalidate();
      toast.success('Brand updated');
      closeForm();
    },
    onError: (e) => onMutationError(e, 'Could not update brand'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => adminBrands.deactivate(id),
    onSuccess: () => {
      invalidate();
      setDeactivateTarget(null);
      toast.success('Brand deactivated', 'It no longer appears in the storefront brand filter.');
    },
    onError: (e) => onMutationError(e, 'Could not deactivate brand'),
  });

  function openCreate() {
    setErrors({});
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setSlugTouched(false);
    setFormOpen(true);
  }
  function openEdit(b: BrandResponse) {
    setErrors({});
    setEditTarget(b);
    setForm(fromBrand(b));
    setSlugTouched(true); // never auto-overwrite an existing brand's slug
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
    setErrors({});
  }

  function setName(name: string) {
    // Auto-suggest the slug from the name until the user edits the slug themselves.
    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.slug.trim()) next.slug = 'Slug is required';
    else if (!SLUG_RE.test(form.slug.trim())) next.slug = 'Use lowercase letters, digits and hyphens';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const base = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      logoUrl: form.logoUrl.trim() || null,
    };
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, body: { ...base, active: form.active } });
    } else {
      createMutation.mutate({ ...base, active: form.active });
    }
  }

  function set<K extends keyof BrandFormState>(key: K, value: BrandFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const columns: Column<BrandResponse>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Brand',
        render: (b) => (
          <div className="flex min-w-0 items-center gap-3">
            {b.logoUrl && (
              <img
                src={b.logoUrl}
                alt=""
                className="h-8 w-8 shrink-0 rounded-lg border border-ink-700 object-cover"
              />
            )}
            <div className="min-w-0">
              {/* Carries the row's action for the keyboard: onRowClick reaches a mouse only. */}
              <button
                type="button"
                onClick={() => openEdit(b)}
                aria-label={`Edit ${b.name}`}
                className="block max-w-full truncate rounded text-left font-medium text-slate-100 transition duration-150 hover:text-gold-300"
              >
                {b.name}
              </button>
              {b.description && <p className="truncate text-xs text-slate-500">{b.description}</p>}
            </div>
          </div>
        ),
      },
      { key: 'slug', header: 'Slug', render: (b) => <span className="font-mono text-xs text-slate-400">{b.slug}</span> },
      {
        key: 'active',
        header: 'Status',
        render: (b) => <Badge tone={b.active ? 'green' : 'gray'}>{b.active ? 'Active' : 'Inactive'}</Badge>,
      },
      {
        key: 'createdAt',
        header: 'Created',
        render: (b) => <span className="whitespace-nowrap text-xs text-slate-500">{formatDate(b.createdAt)}</span>,
      },
    ],
    [],
  );

  const brands = data ?? [];

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle="Organize products by brand and power the storefront brand filter."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New brand
          </Button>
        }
      />

      <Card className="p-0">
        {isError ? (
          <EmptyState
            icon={<Tags className="h-10 w-10" />}
            title="Could not load brands"
            message="Something went wrong fetching the brand list."
            action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
          />
        ) : (
          <DataTable
            columns={columns}
            data={brands}
            getRowKey={(b) => b.id}
            loading={isLoading}
            loadingRows={6}
            empty={
              <EmptyState
                icon={<Tags className="h-10 w-10" />}
                title="No brands yet"
                message="Create your first brand to group products and enable brand filtering."
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" /> New brand
                  </Button>
                }
              />
            }
            onRowClick={openEdit}
            rowActions={(b) => (
              <div className="flex justify-end gap-1">
                {b.active && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeactivateTarget(b)}
                    aria-label={`Deactivate ${b.name}`}
                  >
                    <PowerOff className="h-4 w-4 text-amber-400" />
                  </Button>
                )}
              </div>
            )}
          />
        )}
      </Card>

      {/* Create / edit form */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editTarget ? `Edit ${editTarget.name}` : 'New brand'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button loading={createMutation.isPending || updateMutation.isPending} onClick={submit}>
              {editTarget ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.name} className="sm:col-span-2">
            <Input
              value={form.name}
              onChange={(e) => setName(e.target.value)}
              invalid={!!errors.name}
              placeholder="Royal Textiles"
            />
          </Field>
          <Field
            label="Slug"
            required
            error={errors.slug}
            hint="lowercase-with-hyphens"
            className="sm:col-span-2"
          >
            <Input
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value);
              }}
              invalid={!!errors.slug || (!!form.slug && !SLUG_RE.test(form.slug))}
              placeholder="royal-textiles"
            />
          </Field>
          {/* Was a bare URL box, so the only way to set a logo was to host it
              somewhere else first. Generation is offered under its own subject:
              a mark drafted with the product-photography prompt comes back as a
              photograph of whatever the brand sells, because that prompt bans
              logos outright. */}
          <ImageUploadField
            label="Logo"
            aspect="square"
            hint="Optional. Shown beside the brand wherever it appears."
            className="sm:col-span-2"
            value={form.logoUrl}
            onChange={(url) => set('logoUrl', url)}
            error={errors.logoUrl}
            aiContext={{ brandName: form.name, subject: 'BRAND_LOGO' }}
            aiSingleImage
          />
          <Field label="Description" error={errors.description} hint="Optional" className="sm:col-span-2">
            <Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
              className="h-4 w-4 accent-gold-400"
            />
            Active (shown in the storefront brand filter)
          </label>
        </div>
      </Modal>

      {/* Deactivate confirmation */}
      <ConfirmDialog
        open={deactivateTarget != null}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate this brand?"
        description={
          deactivateTarget
            ? `${deactivateTarget.name} will disappear from the storefront brand filter. Products keep their brand assignment, and you can re-activate it later by editing it.`
            : undefined
        }
        confirmLabel="Deactivate"
        destructive
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
      />
    </div>
  );
}
