import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, UserMinus, UserPlus } from 'lucide-react';
import { platformAdmins } from '@/api/platform';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { formatDate } from '@/lib/format';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, PageHeader, SkeletonTable } from '@/components/ui';
import type { PlatformAdminResponse } from '@/lib/types';

/**
 * Platform operators.
 *
 * The most dangerous screen in the console: an appointment hands someone every
 * merchant on the platform, which is why it confirms first and why the API only
 * lets an existing operator appoint another.
 */
export default function PlatformOperators() {
  useDocumentTitle('Operators');
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingGrant, setPendingGrant] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<PlatformAdminResponse | null>(null);

  const adminsQuery = useQuery({ queryKey: ['platform-admins'], queryFn: platformAdmins.list });
  const admins = adminsQuery.data ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ['platform-admins'] });

  const grantMutation = useMutation({
    mutationFn: (value: string) => platformAdmins.grant({ email: value.trim() }),
    onSuccess: async (granted) => {
      await refresh();
      setEmail('');
      setError(null);
      setPendingGrant(null);
      toast.success(`${granted.email} is now a platform operator`);
    },
    onError: (e) => {
      setPendingGrant(null);
      if (e instanceof ApiError && e.code === 'USER_NOT_FOUND') {
        // The endpoint grants to an account that already exists; it never
        // creates one. Saying "no such user" sends operators hunting for a typo.
        setError('No account with that email yet — ask them to sign up first, then appoint them.');
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not appoint that account.');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) => platformAdmins.revoke(userId),
    onSuccess: async () => {
      await refresh();
      setPendingRevoke(null);
      toast.success('Access revoked');
    },
    onError: (e) => {
      setPendingRevoke(null);
      if (e instanceof ApiError && e.code === 'CANNOT_REVOKE_OWN_PLATFORM_ADMIN') {
        toast.error('You cannot revoke your own access', 'Ask another operator to do it.');
        return;
      }
      toast.error('Could not revoke access', e instanceof Error ? e.message : 'Please try again.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setPendingGrant(value);
  }

  return (
    <>
      <PageHeader title="Operators" subtitle="Accounts that can manage every store on the platform." />

      <Card className="mb-6 flex items-start gap-3 border-warning-300/30 bg-warning-500/5 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning-300" aria-hidden />
        <p className="text-body-sm text-slate-300">
          A platform operator can reach every merchant&apos;s catalogue, orders and customers, and can appoint further
          operators. Only an existing operator can extend this set — no store admin can request it.
        </p>
      </Card>

      <Card className="p-5">
        <form onSubmit={onSubmit} className="flex flex-wrap items-start gap-3">
          <Field
            label="Appoint an existing account"
            error={error}
            hint="The person must already have signed up at some store."
            className="min-w-[18rem] flex-1"
          >
            <Input
              type="email"
              value={email}
              invalid={!!error}
              placeholder="ops@example.com"
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
            />
          </Field>
          <div className="pt-[1.6rem]">
            <Button type="submit" disabled={!email.trim()} loading={grantMutation.isPending}>
              <UserPlus className="h-4 w-4" /> Appoint
            </Button>
          </div>
        </form>

        <div className="mt-6 border-t border-ink-800 pt-4">
          {adminsQuery.isLoading ? (
            <SkeletonTable rows={3} columns={3} />
          ) : adminsQuery.isError ? (
            <EmptyState
              title="Could not load operators"
              message={(adminsQuery.error as Error)?.message}
              action={<Button onClick={() => adminsQuery.refetch()}>Try again</Button>}
            />
          ) : admins.length === 0 ? (
            <EmptyState title="No operators" message="Nobody currently holds platform access." />
          ) : (
            <ul className="divide-y divide-ink-800">
              {admins.map((admin) => {
                const isSelf = admin.userId === user?.id;
                return (
                  <li key={admin.userId} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-sm font-semibold text-gold-300">
                      {admin.fullName?.charAt(0).toUpperCase() ?? '?'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-medium text-slate-100">{admin.fullName}</span>
                      <span className="block truncate text-caption text-slate-500">{admin.email}</span>
                    </span>
                    <span className="text-caption text-slate-500">since {formatDate(admin.since)}</span>
                    {isSelf ? (
                      // Nobody may remove their own access, so the control is not
                      // rendered at all rather than shown and then rejected.
                      <Badge tone="gold">You</Badge>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setPendingRevoke(admin)}>
                        <UserMinus className="h-4 w-4 text-danger-300" /> Revoke
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={!!pendingGrant}
        onOpenChange={(open) => !open && setPendingGrant(null)}
        title="Appoint a platform operator?"
        description={`${pendingGrant} will be able to manage every store on the platform, including creating stores and appointing further operators.`}
        confirmLabel="Appoint"
        loading={grantMutation.isPending}
        onConfirm={() => pendingGrant && grantMutation.mutate(pendingGrant)}
      />

      <ConfirmDialog
        open={!!pendingRevoke}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
        destructive
        title={`Revoke ${pendingRevoke?.fullName ?? ''}?`}
        description="They keep their account and any roles they hold at individual stores; only platform access is removed."
        confirmLabel="Revoke access"
        loading={revokeMutation.isPending}
        onConfirm={() => pendingRevoke && revokeMutation.mutate(pendingRevoke.userId)}
      />
    </>
  );
}
