import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Lock, RotateCcw, ShieldOff, Unlock } from 'lucide-react';
import { adminUsers } from '@/api/admin';
import { ApiError } from '@/lib/http';
import type { RoleName } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader } from '@/components/ui';
import { DetailSkeleton } from '@/components/RouteSkeletons';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { UserStatusBadge } from '@/components/StatusBadge';

const ALL_ROLES: RoleName[] = ['CUSTOMER', 'STAFF', 'ADMIN'];

export default function AdminUserDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: user, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => adminUsers.get(id),
    enabled: !!id,
  });

  const [roles, setRoles] = useState<RoleName[]>([]);
  const [lockOpen, setLockOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (user) setRoles(user.roles);
  }, [user]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'user', id] });
  const onError = (title: string) => (e: unknown) =>
    toast.error(title, e instanceof ApiError ? e.message : 'An unexpected error occurred.');

  const rolesMutation = useMutation({
    mutationFn: (next: RoleName[]) => adminUsers.changeRoles(id, next),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Roles updated');
    },
    onError: onError('Could not update roles'),
  });

  const lockMutation = useMutation({
    mutationFn: () => adminUsers.lock(id, reason.trim() || undefined),
    onSuccess: () => {
      invalidate();
      toast.success('User locked');
      setLockOpen(false);
      setReason('');
    },
    onError: onError('Could not lock user'),
  });

  const unlockMutation = useMutation({
    mutationFn: () => adminUsers.unlock(id),
    onSuccess: () => {
      invalidate();
      toast.success('User unlocked');
    },
    onError: onError('Could not unlock user'),
  });

  const disableMutation = useMutation({
    mutationFn: () => adminUsers.disable(id, reason.trim() || undefined),
    onSuccess: () => {
      invalidate();
      toast.success('User disabled');
      setDisableOpen(false);
      setReason('');
    },
    onError: onError('Could not disable user'),
  });

  const enableMutation = useMutation({
    mutationFn: () => adminUsers.enable(id),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User reactivated');
    },
    onError: onError('Could not reactivate user'),
  });

  useDocumentTitle(user?.fullName ?? 'User');

  if (isLoading) return <DetailSkeleton />;
  if (isError || !user) {
    return (
      <EmptyState
        title="User not found"
        message={(error as Error)?.message}
        action={
          <Link to="/admin/users" className="text-sm text-gold-400 hover:text-gold-300">
            Back to users
          </Link>
        }
      />
    );
  }

  function toggleRole(role: RoleName) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  const rolesChanged =
    roles.length !== user.roles.length || roles.some((r) => !user.roles.includes(r));

  return (
    <div className="max-w-4xl">
      <Link to="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      <PageHeader
        title={user.fullName}
        subtitle={user.email}
        action={<UserStatusBadge status={user.status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-200">Profile</h2>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="text-slate-200">{user.email}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Provider</dt>
                <dd className="text-slate-200">{user.provider.charAt(0) + user.provider.slice(1).toLowerCase()}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Email verified</dt>
                <dd className="text-slate-200">
                  {user.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : 'Not verified'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd><UserStatusBadge status={user.status} /></dd>
              </div>
              <div>
                <dt className="text-slate-500">Joined</dt>
                <dd className="text-slate-200">{formatDateTime(user.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last updated</dt>
                <dd className="text-slate-200">{formatDateTime(user.updatedAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-200">Roles</h2>
            <p className="mb-4 text-xs text-slate-500">A user must keep at least one role.</p>
            <div className="mb-4 flex flex-wrap gap-4">
              {ALL_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} />
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </label>
              ))}
            </div>
            <Button
              size="sm"
              loading={rolesMutation.isPending}
              disabled={roles.length === 0 || !rolesChanged}
              onClick={() => rolesMutation.mutate(roles)}
            >
              Save roles
            </Button>
          </Card>
        </div>

        {/* Status actions */}
        <Card className="h-fit p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Account status</h2>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-slate-400">Current:</span>
            <UserStatusBadge status={user.status} />
          </div>

          {user.status === 'ACTIVE' && (
            <div className="flex flex-col gap-2">
              <Button variant="outline" fullWidth onClick={() => { setReason(''); setLockOpen(true); }}>
                <Lock className="h-4 w-4" /> Lock account
              </Button>
              <Button variant="danger" fullWidth onClick={() => { setReason(''); setDisableOpen(true); }}>
                <ShieldOff className="h-4 w-4" /> Disable account
              </Button>
            </div>
          )}

          {user.status === 'LOCKED' && (
            <Button variant="primary" fullWidth loading={unlockMutation.isPending} onClick={() => unlockMutation.mutate()}>
              <Unlock className="h-4 w-4" /> Unlock account
            </Button>
          )}

          {user.status === 'DISABLED' && (
            <div className="flex flex-col gap-3">
              <p className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm text-slate-400">
                This account is disabled and cannot sign in. Reactivating returns it to ACTIVE.
              </p>
              <Button variant="primary" fullWidth loading={enableMutation.isPending} onClick={() => enableMutation.mutate()}>
                <RotateCcw className="h-4 w-4" /> Reactivate account
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Lock modal */}
      <Modal
        open={lockOpen}
        onClose={() => setLockOpen(false)}
        title="Lock account"
        footer={
          <>
            <Button variant="outline" onClick={() => setLockOpen(false)}>Cancel</Button>
            <Button loading={lockMutation.isPending} onClick={() => lockMutation.mutate()}>Lock</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-400">
          A locked user cannot sign in until unlocked. You can optionally record a reason.
        </p>
        <Field label="Reason (optional)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Suspicious activity" />
        </Field>
      </Modal>

      {/* Disable modal */}
      <Modal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        title="Disable account"
        footer={
          <>
            <Button variant="outline" onClick={() => setDisableOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={disableMutation.isPending} onClick={() => disableMutation.mutate()}>
              Disable
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-400">
          A disabled user cannot sign in. This can be reversed later with “Reactivate account”. You can optionally record a reason.
        </p>
        <Field label="Reason (optional)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Account closed on request" />
        </Field>
      </Modal>
    </div>
  );
}
