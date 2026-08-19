import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserRound } from 'lucide-react';

import { adminStaffProfiles } from '@/api/staff';
import { adminUsers } from '@/api/admin';
import { ApiError } from '@/lib/http';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useBookingsEntitlement } from '@/lib/useBookingsGate';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import type { SaveStaffProfileRequest, StaffProfileResponse } from '@/lib/types';
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
  Select,
  Textarea,
  type Column,
} from '@/components/ui';

interface FormState {
  displayName: string;
  title: string;
  bio: string;
  photoUrl: string;
  userId: string;
  active: boolean;
  sortOrder: string;
}

const EMPTY_FORM: FormState = {
  displayName: '',
  title: '',
  bio: '',
  photoUrl: '',
  userId: '',
  active: true,
  sortOrder: '0',
};

/**
 * The people customers can ask for.
 *
 * A profile is not an account. Most of these entries are just a name and a
 * photograph on the storefront, and the optional link to a login is a separate
 * idea — it is what lets someone who works the counter also appear in the diary
 * as a person appointments are assigned to.
 *
 * There is no per-person rota in this version: everybody is assumed available
 * whenever the shop is open, and their own bookings are what carve out their
 * day. Worth knowing before wondering where the working-hours form went.
 */
export default function AdminStaff() {
  const qc = useQueryClient();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { bookingsAllowed, loading: entitlementLoading } = useBookingsEntitlement();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffProfileResponse | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<StaffProfileResponse | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: adminStaffProfiles.list,
    enabled: bookingsAllowed,
  });

  // Only staff and admins may be linked, so only they are worth offering.
  const usersQuery = useQuery({
    queryKey: ['admin', 'users', 'staff-linkable'],
    queryFn: () => adminUsers.list({ size: 100 }),
    enabled: bookingsAllowed && formOpen,
    staleTime: 5 * 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'staff'] });
    qc.invalidateQueries({ queryKey: ['staff'] });
  };

  function onMutationError(e: unknown, title: string) {
    if (e instanceof ApiError) {
      if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
      else if (e.code === 'STAFF_USER_NOT_ELIGIBLE') {
        setErrors({ userId: 'That account is not an active staff or admin member of this store.' });
      } else if (e.code === 'STAFF_USER_ALREADY_LINKED') {
        setErrors({ userId: 'Another profile is already linked to that account.' });
      } else if (e.code === 'STAFF_HAS_BOOKINGS') {
        toast.error(
          'This person has bookings',
          'Switch them off instead of deleting — appointments in the diary refer to them.',
        );
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
      const body: SaveStaffProfileRequest = {
        displayName: form.displayName.trim(),
        title: form.title.trim() || null,
        bio: form.bio.trim() || null,
        photoUrl: form.photoUrl.trim() || null,
        userId: form.userId || null,
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
      };
      return editTarget ? adminStaffProfiles.update(editTarget.id, body) : adminStaffProfiles.create(body);
    },
    onSuccess: () => {
      invalidate();
      toast.success(editTarget ? 'Profile updated' : 'Added to the team');
      closeForm();
    },
    onError: (e) => onMutationError(e, 'Could not save the profile'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminStaffProfiles.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success('Profile deleted');
    },
    onError: (e) => onMutationError(e, 'Could not delete the profile'),
  });

  function openCreate() {
    setErrors({});
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  }

  function openEdit(s: StaffProfileResponse) {
    setErrors({});
    setEditTarget(s);
    setForm({
      displayName: s.displayName,
      title: s.title ?? '',
      bio: s.bio ?? '',
      photoUrl: s.photoUrl ?? '',
      userId: s.userId ?? '',
      active: s.active,
      sortOrder: String(s.sortOrder),
    });
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

  function submit() {
    if (!form.displayName.trim()) {
      setErrors({ displayName: 'A name is required' });
      return;
    }
    saveMutation.mutate();
  }

  const columns: Column<StaffProfileResponse>[] = useMemo(
    () => [
      {
        key: 'displayName',
        header: 'Name',
        render: (s) => (
          <div className="flex min-w-0 items-center gap-3">
            {s.photoUrl && (
              <img src={s.photoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            )}
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => openEdit(s)}
                aria-label={`Edit ${s.displayName}`}
                className="block max-w-full truncate rounded text-left font-medium text-slate-100 transition hover:text-gold-300"
              >
                {s.displayName}
              </button>
              {s.title && <p className="truncate text-xs text-slate-500">{s.title}</p>}
            </div>
          </div>
        ),
      },
      {
        key: 'userId',
        header: 'Console login',
        render: (s) =>
          s.userId ? (
            <Badge tone="blue">Linked</Badge>
          ) : (
            <span className="text-xs text-slate-500">Profile only</span>
          ),
      },
      {
        key: 'active',
        header: 'Status',
        render: (s) => <Badge tone={s.active ? 'green' : 'gray'}>{s.active ? 'Bookable' : 'Hidden'}</Badge>,
      },
    ],
    [],
  );

  if (entitlementLoading) return null;
  if (!bookingsAllowed) {
    return (
      <EmptyState
        icon={<UserRound className="h-6 w-6" aria-hidden />}
        title="Bookings aren’t part of this store’s plan"
        message="Get in touch with us and we can switch appointments on for you."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Who customers can ask for when they book."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden /> Add someone
          </Button>
        }
      />

      <Card className="p-4">
        {isError ? (
          <EmptyState title="Could not load the team" message="Please try again shortly." />
        ) : (
          <DataTable
            columns={columns}
            data={data ?? []}
            getRowKey={(s) => s.id}
            loading={isLoading}
            empty={
              <EmptyState
                icon={<UserRound className="h-6 w-6" aria-hidden />}
                title="Nobody added yet"
                message="Bookings still work without this — customers simply do not get to choose a person."
                action={<Button onClick={openCreate}>Add someone</Button>}
              />
            }
            rowActions={
              isAdmin
                ? (s) => (
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(s)}>
                      Delete
                    </Button>
                  )
                : undefined
            }
          />
        )}
      </Card>

      {formOpen && (
        <Modal
          open
          onClose={closeForm}
          size="lg"
          title={editTarget ? 'Edit profile' : 'Add someone'}
          footer={
            <>
              <Button variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button onClick={submit} loading={saveMutation.isPending}>
                {editTarget ? 'Save changes' : 'Add to team'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Name" required error={errors.displayName}>
              <Input
                aria-label="Display name"
                value={form.displayName}
                onChange={(e) => set('displayName', e.target.value)}
                placeholder="Priya"
              />
            </Field>
            <Field label="Role" hint="Shown under their name, e.g. Senior therapist">
              <Input aria-label="Role" value={form.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="About">
              <Textarea aria-label="About" rows={3} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
            </Field>

            <ImageUploadField label="Photo" value={form.photoUrl} onChange={(url) => set('photoUrl', url)} />

            <Field
              label="Console login"
              hint="Optional — link this profile to someone who signs in here"
              error={errors.userId}
            >
              <Select aria-label="Console login" value={form.userId} onChange={(e) => set('userId', e.target.value)}>
                <option value="">Not linked</option>
                {(usersQuery.data?.content ?? [])
                  .filter((u) => u.roles.includes('STAFF') || u.roles.includes('ADMIN'))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} · {u.email}
                    </option>
                  ))}
              </Select>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Order in the list" hint="Lower numbers come first">
                <Input
                  aria-label="Sort order"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => set('sortOrder', e.target.value)}
                />
              </Field>
              <Field label="Bookable">
                <label className="flex items-center gap-2 text-body-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => set('active', e.target.checked)}
                    aria-label="Bookable"
                    className="h-4 w-4 rounded border-ink-600"
                  />
                  Customers can ask for them
                </label>
              </Field>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.displayName ?? 'this profile'}?`}
        description="If they appear in any booking the server will refuse — switch them off instead, which takes them off the storefront and keeps the diary intact."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
