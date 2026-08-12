import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Info, ShieldCheck, UserCog } from 'lucide-react';
import { platformStoreUsers, platformStores } from '@/api/platform';
import { ApiError } from '@/lib/http';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { formatDate } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FilterChip,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  type Column,
} from '@/components/ui';
import type { RoleName, UserResponse, UserStatus } from '@/lib/types';

/**
 * A store's members, as the platform sees them.
 *
 * Its own route rather than a card on the store page: search, filters and the
 * page number all live in the URL, so a link to "the admins of Nova Sports"
 * survives a refresh and can be pasted to a colleague.
 */

/** What an operator may set from here. PLATFORM_ADMIN is absent deliberately —
 *  it is granted only from the Operators screen, and the API refuses it here
 *  regardless of what this list says. */
const ASSIGNABLE: { value: string; label: string; roles: RoleName[]; consequence: string }[] = [
  {
    value: 'CUSTOMER',
    label: 'Customer',
    roles: ['CUSTOMER'],
    consequence: 'They keep their orders and account, and lose all access to this store’s console.',
  },
  {
    value: 'STAFF',
    label: 'Staff',
    roles: ['CUSTOMER', 'STAFF'],
    consequence:
      'They can manage products, orders, coupons and reviews for this store — but not its users or settings.',
  },
  {
    value: 'ADMIN',
    label: 'Admin',
    roles: ['CUSTOMER', 'STAFF', 'ADMIN'],
    consequence: 'Full control of this store, including its users, payment keys and settings.',
  },
];

/** The highest role held — roles are cumulative, so this is what the picker shows. */
function primaryRole(roles: RoleName[]): string {
  if (roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('STAFF')) return 'STAFF';
  return 'CUSTOMER';
}

const ROLE_TONE: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  ADMIN: 'gold',
  STAFF: 'blue',
  CUSTOMER: 'gray',
};

const STATUS_TONE: Record<UserStatus, Parameters<typeof Badge>[0]['tone']> = {
  ACTIVE: 'green',
  LOCKED: 'amber',
  DISABLED: 'red',
};

const ROLE_FILTERS = [
  { value: '', label: 'All roles' },
  { value: 'ADMIN', label: 'Admins' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'CUSTOMER', label: 'Customers' },
];

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Any status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'LOCKED', label: 'Locked' },
  { value: 'DISABLED', label: 'Disabled' },
];

/**
 * Page sizes. The API filters by search only — there is no role or status
 * parameter — so those two are applied here, over what has been fetched. A
 * bigger page while a filter is on makes that complete for any realistic store;
 * `FILTERED_SIZE` is the point past which we say so out loud rather than
 * present a partial list as the whole answer.
 */
const PAGE_SIZE = 20;
const FILTERED_SIZE = 200;

export default function PlatformStoreMembers() {
  const { storeId = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();

  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const roleFilter = params.get('role') ?? '';
  const statusFilter = params.get('status') ?? '';
  const page = Math.max(0, Number(params.get('page') ?? '0') || 0);
  const filtering = !!roleFilter || !!statusFilter;

  const [pending, setPending] = useState<{ member: UserResponse; next: (typeof ASSIGNABLE)[number] } | null>(null);

  function setParam(patch: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    // Any change to what is being looked at invalidates the page number.
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  }

  const storeQuery = useQuery({
    queryKey: ['platform-store', storeId],
    queryFn: () => platformStores.get(storeId),
    enabled: !!storeId,
  });
  const store = storeQuery.data;
  useDocumentTitle(store ? `Members · ${store.name}` : 'Members');

  const size = filtering ? FILTERED_SIZE : PAGE_SIZE;
  const membersQuery = useQuery({
    queryKey: ['platform-store-users', storeId, search, page, size],
    queryFn: () => platformStoreUsers.list(storeId, { search: search || undefined, page, size }),
    enabled: !!storeId,
  });

  const loaded = useMemo(() => membersQuery.data?.content ?? [], [membersQuery.data]);
  const totalElements = membersQuery.data?.totalElements ?? 0;

  const members = useMemo(
    () =>
      loaded.filter((m) => {
        if (statusFilter && m.status !== statusFilter) return false;
        if (!roleFilter) return true;
        // Roles are cumulative, so "Staff" means exactly staff — an admin is not
        // listed under it, or the filter would be useless for finding the two apart.
        return primaryRole(m.roles) === roleFilter;
      }),
    [loaded, roleFilter, statusFilter],
  );

  // True when a client-side filter could be hiding matches the server never sent.
  const filterIsPartial = filtering && totalElements > loaded.length;

  const rolesMutation = useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: RoleName[] }) =>
      platformStoreUsers.changeRoles(storeId, userId, roles),
    onSuccess: async (updated) => {
      await qc.invalidateQueries({ queryKey: ['platform-store-users', storeId] });
      setPending(null);
      toast.success(
        `${updated.fullName || updated.email} is now ${primaryRole(updated.roles).toLowerCase()}`,
        'Roles are per store — their access at other shops is unchanged.',
      );
    },
    onError: (e) => {
      setPending(null);
      // Both are rules only the server can decide: seats depend on a live count,
      // and a target may hold PLATFORM_ADMIN without this list showing it.
      if (e instanceof ApiError && e.code === 'STAFF_SEAT_LIMIT_REACHED') {
        toast.error('No staff seats left', 'Raise the seat limit on the store page, or demote someone first.');
        return;
      }
      if (e instanceof ApiError && e.code === 'CANNOT_MODIFY_PLATFORM_ADMIN') {
        toast.error('That account is a platform operator', 'Change it from the Operators screen instead.');
        return;
      }
      toast.error('Could not change roles', e instanceof Error ? e.message : 'Please try again.');
    },
  });

  const columns: Column<UserResponse>[] = [
    {
      key: 'member',
      header: 'Member',
      render: (m) => (
        <div className="min-w-0">
          <p className="truncate text-body-sm text-slate-100">{m.fullName || '—'}</p>
          <p className="truncate text-caption text-slate-500">{m.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role here',
      render: (m) =>
        m.roles.includes('PLATFORM_ADMIN') ? (
          <span className="inline-flex items-center gap-1.5">
            <Badge tone="purple">Platform operator</Badge>
          </span>
        ) : (
          <Badge tone={ROLE_TONE[primaryRole(m.roles)]}>
            {ASSIGNABLE.find((r) => r.value === primaryRole(m.roles))?.label ?? primaryRole(m.roles)}
          </Badge>
        ),
    },
    {
      key: 'status',
      header: 'Account',
      render: (m) => <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (m) => <span className="text-caption text-slate-400">{formatDate(m.createdAt)}</span>,
    },
  ];

  if (storeQuery.isError) {
    return (
      <EmptyState
        title="Could not load this store"
        message={(storeQuery.error as Error)?.message}
        action={
          <Link to="/platform">
            <Button variant="secondary">Back to stores</Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <Link
        to={`/platform/stores/${storeId}`}
        className="mb-4 inline-flex items-center gap-2 text-body-sm text-slate-400 transition hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" /> {store ? store.name : 'Back to store'}
      </Link>

      <PageHeader
        title="Members"
        subtitle={
          store
            ? `Everyone with a membership of ${store.name}. Roles are per store — changing them here affects this shop only.`
            : 'Everyone with a membership of this store.'
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[16rem] flex-1">
            <SearchInput
              defaultValue={search}
              onSearch={(v) => setParam({ q: v })}
              placeholder="Search by name or email…"
              aria-label="Search members"
            />
          </div>
          <span className="text-caption text-slate-500">
            {totalElements} member{totalElements === 1 ? '' : 's'}
            {store?.maxStaffSeats != null ? ` · ${store.maxStaffSeats} staff seats` : ''}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-overline uppercase text-slate-500">Role</span>
          {ROLE_FILTERS.map((f) => (
            <FilterChip key={f.value} selected={roleFilter === f.value} onClick={() => setParam({ role: f.value })}>
              {f.label}
            </FilterChip>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-overline uppercase text-slate-500">Status</span>
          {STATUS_FILTERS.map((f) => (
            <FilterChip key={f.value} selected={statusFilter === f.value} onClick={() => setParam({ status: f.value })}>
              {f.label}
            </FilterChip>
          ))}
        </div>

        {filterIsPartial && (
          // Saying this plainly beats a filter that looks authoritative and isn't.
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-ink-700 bg-ink-850 p-3 text-caption text-slate-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            The API filters by search only, so the role and status filters are applied to the {loaded.length} members
            loaded here, out of {totalElements}. Narrow it with a search to be certain you are seeing everyone.
          </p>
        )}

        <div className="mt-5">
          <DataTable
            columns={columns}
            data={members}
            getRowKey={(m) => m.id}
            loading={membersQuery.isLoading}
            empty={
              membersQuery.isError ? (
                <EmptyState
                  title="Could not load members"
                  message={(membersQuery.error as Error)?.message}
                  action={<Button onClick={() => membersQuery.refetch()}>Try again</Button>}
                />
              ) : (
                <EmptyState
                  icon={<UserCog className="h-10 w-10 text-slate-500" />}
                  title={search || filtering ? 'Nobody matches that' : 'This store has no members yet'}
                  message={
                    search || filtering
                      ? 'Try a different search, or clear the filters.'
                      : 'People become members by signing in at this store.'
                  }
                />
              )
            }
            rowActions={(m) =>
              m.roles.includes('PLATFORM_ADMIN') ? (
                // The API refuses this outright; an inert control with a reason
                // beats a live one that always fails.
                <span className="flex items-center gap-1.5 whitespace-nowrap text-caption text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Managed in Operators
                </span>
              ) : (
                <Select
                  aria-label={`Role for ${m.email}`}
                  className="w-36"
                  value={primaryRole(m.roles)}
                  disabled={rolesMutation.isPending}
                  onChange={(e) => {
                    const next = ASSIGNABLE.find((r) => r.value === e.target.value);
                    // Re-selecting the current role is not a change worth confirming.
                    if (next && next.value !== primaryRole(m.roles)) setPending({ member: m, next });
                  }}
                >
                  {ASSIGNABLE.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              )
            }
          />
        </div>

        {!filtering && (
          <Pagination
            page={membersQuery.data?.number ?? 0}
            totalPages={membersQuery.data?.totalPages ?? 0}
            onChange={(p) => setParam({ page: String(p) })}
          />
        )}
      </Card>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
        destructive={pending?.next.value === 'ADMIN'}
        title={`Make ${pending?.member.fullName || pending?.member.email} ${pending?.next.label.toLowerCase()}?`}
        description={`${pending?.next.consequence ?? ''} This applies to ${
          store?.name ?? 'this store'
        } only — their roles at other shops are untouched.`}
        confirmLabel={`Make ${pending?.next.label.toLowerCase()}`}
        loading={rolesMutation.isPending}
        onConfirm={() =>
          pending && rolesMutation.mutate({ userId: pending.member.id, roles: pending.next.roles })
        }
      />
    </>
  );
}
