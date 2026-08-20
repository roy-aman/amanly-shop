import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Pencil, Plus, Trash2, UserRound } from 'lucide-react';

import { adminStaffProfiles } from '@/api/staff';
import { adminBookings } from '@/api/bookings';
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
  Switch,
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
  const navigate = useNavigate();
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

  /**
   * How many appointments each person has still to come.
   *
   * One small request per person rather than one big one: the diary endpoint
   * filters by a single staff id, and asking for every future booking to count
   * them here would pull the whole diary into the browser to derive a handful of
   * numbers. `size: 1` means the server does the counting — only `totalElements`
   * is read.
   */
  const staff = data ?? [];
  const upcomingQueries = useQueries({
    queries: staff.map((profile) => ({
      queryKey: ['admin', 'bookings', 'upcoming-count', profile.id],
      queryFn: () =>
        adminBookings.list({
          staffId: profile.id,
          status: 'CONFIRMED' as const,
          from: new Date().toISOString(),
          size: 1,
        }),
      enabled: bookingsAllowed,
      staleTime: 60_000,
    })),
  });

  const upcomingByStaff = useMemo(() => {
    const counts: Record<string, number | undefined> = {};
    staff.forEach((profile, i) => {
      counts[profile.id] = upcomingQueries[i]?.data?.totalElements;
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, upcomingQueries.map((q) => q.data?.totalElements).join(',')]);

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

  /** Bookable on and off in place, without opening the form. */
  const toggleMutation = useMutation({
    mutationFn: (profile: StaffProfileResponse) =>
      adminStaffProfiles.update(profile.id, {
        userId: profile.userId,
        displayName: profile.displayName,
        title: profile.title,
        bio: profile.bio,
        photoUrl: profile.photoUrl,
        sortOrder: profile.sortOrder,
        active: !profile.active,
      }),
    onSuccess: (updated) => {
      invalidate();
      toast.success(updated.active ? 'Back on the team list' : 'Hidden from customers');
    },
    onError: (e) => onMutationError(e, 'Could not change that'),
  });

  const togglingId = toggleMutation.isPending ? toggleMutation.variables?.id : undefined;

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
        key: 'upcoming',
        header: 'Coming up',
        // The number that makes this a working screen rather than a directory:
        // who is busy, and who has nothing booked.
        render: (s) => {
          const count = upcomingByStaff[s.id];
          if (count == null) return <span className="text-xs text-slate-600">—</span>;
          return count === 0 ? (
            <span className="text-xs text-slate-500">Nothing booked</span>
          ) : (
            <span className="tabular-nums text-slate-200">
              {count} appointment{count === 1 ? '' : 's'}
            </span>
          );
        },
      },
      {
        key: 'active',
        header: 'Bookable',
        render: (s) => (
          <span onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={s.active}
            label={`${s.active ? 'Hide' : 'Show'} ${s.displayName}`}
            size="sm"
            disabled={togglingId === s.id}
            onChange={() => toggleMutation.mutate(s)}
          />
          </span>
        ),
      },
    ],
    [togglingId, upcomingByStaff],
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
            data={staff}
            getRowKey={(s) => s.id}
            onRowClick={openEdit}
            loading={isLoading}
            empty={
              <EmptyState
                icon={<UserRound className="h-6 w-6" aria-hidden />}
                title="Nobody added yet"
                message="Bookings still work without this — customers simply do not get to choose a person."
                action={<Button onClick={openCreate}>Add someone</Button>}
              />
            }
            rowActions={(s) => (
              <div className="flex justify-end gap-1">
                {/* Straight to that person's diary, pre-filtered — the question
                    a manager opens this page with. */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/admin/bookings?view=list&staffId=${s.id}`)}
                  aria-label={`See ${s.displayName}'s bookings`}
                >
                  <CalendarClock className="h-4 w-4" aria-hidden /> Bookings
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(s)} aria-label={`Edit ${s.displayName}`}>
                  <Pencil className="h-4 w-4" aria-hidden /> Edit
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(s)}
                    aria-label={`Delete ${s.displayName}`}
                  >
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
              <div className="self-end pb-2">
                <Switch
                  checked={form.active}
                  onChange={(next) => set('active', next)}
                  label="Bookable"
                  description="Customers can ask for them by name"
                />
              </div>
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
