import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';

import { adminServiceCategories } from '@/api/services';
import { ApiError } from '@/lib/http';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useBookingsEntitlement } from '@/lib/useBookingsGate';
import type { ServiceCategoryResponse } from '@/lib/types';
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
  Switch,
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

interface FormState {
  name: string;
  slug: string;
  sortOrder: string;
  active: boolean;
}

const EMPTY_FORM: FormState = { name: '', slug: '', sortOrder: '0', active: true };

/**
 * How the service menu is divided up.
 *
 * A flat list, not a tree — the product catalogue nests categories, this one
 * deliberately does not. A menu is read top to bottom in one pass, and a
 * two-level menu of six services is filing rather than navigation.
 */
export default function AdminServiceCategories() {
  const qc = useQueryClient();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { bookingsAllowed, loading: entitlementLoading } = useBookingsEntitlement();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceCategoryResponse | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<ServiceCategoryResponse | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'service-categories'],
    queryFn: adminServiceCategories.list,
    enabled: bookingsAllowed,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'service-categories'] });
    qc.invalidateQueries({ queryKey: ['service-categories'] });
  };

  function onMutationError(e: unknown, title: string) {
    if (e instanceof ApiError) {
      if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
      else if (e.code === 'SERVICE_CATEGORY_SLUG_EXISTS') {
        setErrors({ slug: 'A group with this slug already exists.' });
      } else if (e.code === 'SERVICE_CATEGORY_IN_USE') {
        toast.error('This group still has services in it', 'Move them elsewhere first, or switch it off.');
        setDeleteTarget(null);
        return;
      }
      toast.error(title, e.message);
    } else {
      toast.error(title, 'An unexpected error occurred.');
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        sortOrder: Number(form.sortOrder) || 0,
        active: form.active,
      };
      // Update replaces the row wholesale, so both values go every time.
      return editTarget
        ? adminServiceCategories.update(editTarget.id, body)
        : adminServiceCategories.create(body);
    },
    onSuccess: () => {
      invalidate();
      toast.success(editTarget ? 'Group updated' : 'Group added');
      closeForm();
    },
    onError: (e) => onMutationError(e, 'Could not save the group'),
  });

  /** Show/hide in place. A full replace like any other edit, so both required
   *  values go back with only `active` changed. */
  const toggleMutation = useMutation({
    mutationFn: (c: ServiceCategoryResponse) =>
      adminServiceCategories.update(c.id, {
        name: c.name,
        slug: c.slug,
        sortOrder: c.sortOrder,
        active: !c.active,
      }),
    onSuccess: (updated) => {
      invalidate();
      toast.success(updated.active ? 'Group shown' : 'Group hidden');
    },
    onError: (e) => onMutationError(e, 'Could not change that'),
  });

  const togglingId = toggleMutation.isPending ? toggleMutation.variables?.id : undefined;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminServiceCategories.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success('Group deleted');
    },
    onError: (e) => onMutationError(e, 'Could not delete the group'),
  });

  function openCreate() {
    setErrors({});
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setSlugTouched(false);
    setFormOpen(true);
  }

  function openEdit(c: ServiceCategoryResponse) {
    setErrors({});
    setEditTarget(c);
    setForm({ name: c.name, slug: c.slug, sortOrder: String(c.sortOrder), active: c.active });
    setSlugTouched(true);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
    setErrors({});
  }

  function submit() {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.slug.trim()) next.slug = 'Slug is required';
    else if (!SLUG_RE.test(form.slug.trim())) next.slug = 'Use lowercase letters, digits and hyphens';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    saveMutation.mutate();
  }

  const columns: Column<ServiceCategoryResponse>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Group',
        render: (c) => (
          <button
            type="button"
            onClick={() => openEdit(c)}
            className="rounded text-left font-medium text-slate-100 transition hover:text-gold-300"
          >
            {c.name}
          </button>
        ),
      },
      { key: 'slug', header: 'Slug', render: (c) => <span className="font-mono text-xs text-slate-400">{c.slug}</span> },
      { key: 'sortOrder', header: 'Order', render: (c) => <span className="tabular-nums">{c.sortOrder}</span> },
      {
        key: 'active',
        header: 'Shown',
        render: (c) => (
          <Switch
            checked={c.active}
            label={`${c.active ? 'Hide' : 'Show'} ${c.name}`}
            size="sm"
            disabled={togglingId === c.id}
            onChange={() => toggleMutation.mutate(c)}
          />
        ),
      },
    ],
    [togglingId],
  );

  if (entitlementLoading) return null;
  if (!bookingsAllowed) {
    return (
      <EmptyState
        icon={<FolderTree className="h-6 w-6" aria-hidden />}
        title="Bookings aren’t part of this store’s plan"
        message="Get in touch with us and we can switch appointments on for you."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Service groups"
        subtitle="Sections your menu is divided into, in the order customers see them."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden /> Add group
          </Button>
        }
      />

      <Card className="p-4">
        {isError ? (
          <EmptyState title="Could not load groups" message="Please try again shortly." />
        ) : (
          <DataTable
            columns={columns}
            data={data ?? []}
            getRowKey={(c) => c.id}
            loading={isLoading}
            empty={
              <EmptyState
                icon={<FolderTree className="h-6 w-6" aria-hidden />}
                title="No groups yet"
                message="Groups are optional — services without one simply appear on their own."
                action={<Button onClick={openCreate}>Add group</Button>}
              />
            }
            rowActions={(c) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(c)} aria-label={`Edit ${c.name}`}>
                  <Pencil className="h-4 w-4" aria-hidden /> Edit
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)} aria-label={`Delete ${c.name}`}>
                    <Trash2 className="h-4 w-4 text-danger-400" aria-hidden /> Delete
                  </Button>
                )}
              </div>
            )}
          />
        )}
      </Card>

      {formOpen && (
        <Modal
          open
          onClose={closeForm}
          title={editTarget ? 'Edit group' : 'Add group'}
          footer={
            <>
              <Button variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button onClick={submit} loading={saveMutation.isPending}>
                {editTarget ? 'Save changes' : 'Add group'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Name" required error={errors.name}>
              <Input
                aria-label="Group name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: slugTouched ? f.slug : slugify(e.target.value),
                  }))
                }
                placeholder="Massage"
              />
            </Field>
            <Field label="Web address" error={errors.slug}>
              <Input
                aria-label="Slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: e.target.value }));
                }}
              />
            </Field>
            <Field label="Order in the menu" hint="Lower numbers come first">
              <Input
                aria-label="Sort order"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </Field>
            <Switch
              checked={form.active}
              onChange={(next) => setForm((f) => ({ ...f, active: next }))}
              label="Shown to customers"
              description="Hidden groups keep their services; the services just appear without a heading."
            />
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? 'this group'}?`}
        description="Only possible while nothing sits in it. Services in this group must be moved elsewhere first."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
