import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { adminUsers } from '@/api/admin';
import { ApiError } from '@/lib/http';
import type { RoleName } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Card, EmptyState, Field, Input, PasswordInput, Modal, PageHeader, Pagination, SkeletonTable } from '@/components/ui';
import { UserStatusBadge } from '@/components/StatusBadge';

const ALL_ROLES: RoleName[] = ['CUSTOMER', 'STAFF', 'ADMIN'];
const PAGE_SIZE = 15;

// PLATFORM_ADMIN is never grantable here (see ALL_ROLES — the admin user API
// refuses it by design, so a store owner can never reach another store). It is
// still in the map because an operator's own account can appear in this list.
const ROLE_TONE: Record<RoleName, Parameters<typeof Badge>[0]['tone']> = {
  CUSTOMER: 'gray',
  STAFF: 'blue',
  ADMIN: 'gold',
  PLATFORM_ADMIN: 'purple',
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<{ email: string; fullName: string; password: string; roles: RoleName[] }>({
    email: '',
    fullName: '',
    password: '',
    roles: ['CUSTOMER'],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'users', { page, search }],
    queryFn: () => adminUsers.list({ page, size: PAGE_SIZE, search: search || undefined }),
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      adminUsers.create({
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        password: form.password,
        roles: form.roles,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User created');
      setCreateOpen(false);
      setForm({ email: '', fullName: '', password: '', roles: ['CUSTOMER'] });
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
        toast.error('Could not create user', e.message);
      } else {
        toast.error('Could not create user');
      }
    },
  });

  function toggleRole(role: RoleName) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }));
  }

  const rows = data?.content ?? [];

  return (
    <div>
      <PageHeader
        title="Teams & Users"
        subtitle="Manage customer and staff accounts."
        action={
          <Button
            onClick={() => {
              setErrors({});
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Create user
          </Button>
        }
      />

      <Card className="p-4">
        <div className="mb-4">
          <Input
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="sm:max-w-xs"
          />
        </div>

        {isLoading ? (
          <SkeletonTable rows={8} columns={6} />
        ) : isError ? (
          <EmptyState title="Could not load users" message={(error as Error)?.message} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Users className="h-10 w-10" />} title="No users" message="No users match your search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Roles</th>
                  <th className="px-3 py-2 font-medium">Provider</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                    className="cursor-pointer transition hover:bg-ink-800/40"
                  >
                    <td className="px-3 py-3 font-medium text-slate-100">{u.fullName}</td>
                    <td className="px-3 py-3 text-slate-400">{u.email}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r} tone={ROLE_TONE[r]}>
                            {r.charAt(0) + r.slice(1).toLowerCase()}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-400">{u.provider.charAt(0) + u.provider.slice(1).toLowerCase()}</td>
                    <td className="px-3 py-3">
                      <UserStatusBadge status={u.status} />
                    </td>
                    <td className="px-3 py-3 text-slate-400">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && <Pagination page={data.number} totalPages={data.totalPages} onChange={setPage} />}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create user"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={form.roles.length === 0}
              onClick={() => createMutation.mutate()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name" required error={errors.fullName}>
            <Input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              invalid={!!errors.fullName}
            />
          </Field>
          <Field label="Email" required error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              invalid={!!errors.email}
            />
          </Field>
          <Field label="Password" required error={errors.password} hint="12+ characters, mixed case, numbers & symbols">
            <PasswordInput
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              invalid={!!errors.password}
            />
          </Field>
          <Field label="Roles" required error={errors.roles}>
            <div className="flex flex-wrap gap-4">
              {ALL_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r)} />
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
