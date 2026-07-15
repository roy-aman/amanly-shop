import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, PowerOff, TicketPercent, Trash2 } from 'lucide-react';
import { adminCoupons } from '@/api/admin';
import { getPublicStore } from '@/api/store';
import { ApiError } from '@/lib/http';
import { formatDate, money } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type {
  AdminCouponResponse,
  CouponType,
  CreateCouponRequest,
  UpdateCouponRequest,
} from '@/lib/types';
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
  Pagination,
  Select,
  type Column,
} from '@/components/ui';

const PAGE_SIZE = 20;

interface CouponFormState {
  code: string;
  type: CouponType;
  value: string;
  minOrderAmount: string;
  startsAt: string; // datetime-local
  endsAt: string; // datetime-local
  maxRedemptions: string;
  perUserLimit: string;
  active: boolean;
}

const EMPTY_FORM: CouponFormState = {
  code: '',
  type: 'PERCENT',
  value: '',
  minOrderAmount: '',
  startsAt: '',
  endsAt: '',
  maxRedemptions: '',
  perUserLimit: '',
  active: true,
};

// ── datetime-local ⇄ ISO instant helpers ──────────────────────────────
function toInstant(local: string): string | null {
  if (!local.trim()) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function numOrNull(s: string): number | null {
  const t = s.trim();
  return t ? Number(t) : null;
}

function fromCoupon(c: AdminCouponResponse): CouponFormState {
  return {
    code: c.code,
    type: c.type,
    value: String(c.value),
    minOrderAmount: c.minOrderAmount != null ? String(c.minOrderAmount) : '',
    startsAt: toLocalInput(c.startsAt),
    endsAt: toLocalInput(c.endsAt),
    maxRedemptions: c.maxRedemptions != null ? String(c.maxRedemptions) : '',
    perUserLimit: c.perUserLimit != null ? String(c.perUserLimit) : '',
    active: c.active,
  };
}

export default function Coupons() {
  const qc = useQueryClient();
  const toast = useToast();
  const { isAdmin } = useAuth();

  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminCouponResponse | null>(null);
  const [form, setForm] = useState<CouponFormState>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deactivateTarget, setDeactivateTarget] = useState<AdminCouponResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCouponResponse | null>(null);

  const { data: store } = useQuery({ queryKey: ['public-store'], queryFn: getPublicStore, staleTime: 5 * 60_000 });
  const currency = store?.currency ?? 'USD';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'coupons', page],
    queryFn: () => adminCoupons.list({ page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });

  function onMutationError(e: unknown, title: string) {
    if (e instanceof ApiError) {
      if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
      toast.error(title, e.message);
    } else {
      toast.error(title, 'An unexpected error occurred.');
    }
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateCouponRequest) => adminCoupons.create(body),
    onSuccess: () => {
      invalidate();
      toast.success('Coupon created');
      closeForm();
    },
    onError: (e) => onMutationError(e, 'Could not create coupon'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCouponRequest }) => adminCoupons.update(id, body),
    onSuccess: () => {
      invalidate();
      toast.success('Coupon updated');
      closeForm();
    },
    onError: (e) => onMutationError(e, 'Could not update coupon'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => adminCoupons.deactivate(id),
    onSuccess: () => {
      invalidate();
      setDeactivateTarget(null);
      toast.success('Coupon deactivated', 'It can no longer be applied at checkout.');
    },
    onError: (e) => onMutationError(e, 'Could not deactivate'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminCoupons.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success('Coupon deleted');
    },
    onError: (e) => {
      // A used coupon cannot be hard-deleted — steer the admin to deactivate it.
      if (e instanceof ApiError && (e.code === 'COUPON_HAS_REDEMPTIONS' || e.status === 409)) {
        toast.error('Coupon has redemptions', 'Deactivate it instead — deleting a used coupon is not allowed.');
        return;
      }
      onMutationError(e, 'Could not delete');
    },
  });

  function openCreate() {
    setErrors({});
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  }
  function openEdit(c: AdminCouponResponse) {
    setErrors({});
    setEditTarget(c);
    setForm(fromCoupon(c));
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
    setErrors({});
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.code.trim()) next.code = 'Code is required';
    const value = Number(form.value);
    if (!form.value.trim() || Number.isNaN(value) || value <= 0) next.value = 'Enter a value greater than 0';
    else if (form.type === 'PERCENT' && value > 100) next.value = 'A percentage cannot exceed 100';
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      next.endsAt = 'End must be after start';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const base = {
      code: form.code.trim(),
      type: form.type,
      value: Number(form.value),
      minOrderAmount: numOrNull(form.minOrderAmount),
      startsAt: toInstant(form.startsAt),
      endsAt: toInstant(form.endsAt),
      maxRedemptions: numOrNull(form.maxRedemptions),
      perUserLimit: numOrNull(form.perUserLimit),
    };
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, body: { ...base, active: form.active } });
    } else {
      createMutation.mutate({ ...base, active: form.active });
    }
  }

  function set<K extends keyof CouponFormState>(key: K, value: CouponFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function formatValue(c: AdminCouponResponse): string {
    return c.type === 'PERCENT' ? `${c.value}%` : money(c.value, currency);
  }
  function formatWindow(c: AdminCouponResponse): string {
    if (!c.startsAt && !c.endsAt) return 'Always active';
    const from = c.startsAt ? formatDate(c.startsAt) : '—';
    const to = c.endsAt ? formatDate(c.endsAt) : 'no end';
    return `${from} → ${to}`;
  }

  const columns: Column<AdminCouponResponse>[] = useMemo(
    () => [
      {
        key: 'code',
        header: 'Code',
        render: (c) => (
          <div className="min-w-0">
            <span className="font-mono font-semibold text-slate-100">{c.code}</span>
            {c.minOrderAmount != null && (
              <p className="text-xs text-slate-500">Min order {money(c.minOrderAmount, currency)}</p>
            )}
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        render: (c) => <Badge tone={c.type === 'PERCENT' ? 'blue' : 'purple'}>{c.type}</Badge>,
      },
      { key: 'value', header: 'Value', render: (c) => <span className="text-slate-200">{formatValue(c)}</span> },
      {
        key: 'redemptions',
        header: 'Redemptions',
        render: (c) => (
          <span className="whitespace-nowrap text-slate-300">
            {c.totalRedemptions}
            {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ''}
            {c.perUserLimit != null && <span className="text-slate-500"> · {c.perUserLimit}/user</span>}
          </span>
        ),
      },
      {
        key: 'window',
        header: 'Window',
        render: (c) => <span className="whitespace-nowrap text-xs text-slate-400">{formatWindow(c)}</span>,
      },
      {
        key: 'active',
        header: 'Status',
        render: (c) => <Badge tone={c.active ? 'green' : 'gray'}>{c.active ? 'Active' : 'Inactive'}</Badge>,
      },
    ],
    [currency],
  );

  const coupons = data?.content ?? [];

  return (
    <div>
      <PageHeader
        title="Coupons"
        subtitle="Create and manage discount codes for the storefront."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New coupon
          </Button>
        }
      />

      <Card className="p-0">
        {isError ? (
          <EmptyState
            icon={<TicketPercent className="h-10 w-10" />}
            title="Could not load coupons"
            message="Something went wrong fetching the coupon list."
            action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
          />
        ) : (
          <DataTable
            columns={columns}
            data={coupons}
            getRowKey={(c) => c.id}
            loading={isLoading}
            loadingRows={6}
            empty={
              <EmptyState
                icon={<TicketPercent className="h-10 w-10" />}
                title="No coupons yet"
                message="Create your first discount code to run a promotion."
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" /> New coupon
                  </Button>
                }
              />
            }
            rowActions={(c) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)} aria-label={`Edit ${c.code}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {c.active && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeactivateTarget(c)}
                    aria-label={`Deactivate ${c.code}`}
                  >
                    <PowerOff className="h-4 w-4 text-amber-400" />
                  </Button>
                )}
                {isAdmin && (
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(c)} aria-label={`Delete ${c.code}`}>
                    <Trash2 className="h-4 w-4 text-danger-400" />
                  </Button>
                )}
              </div>
            )}
          />
        )}
      </Card>

      {data && data.totalPages > 1 && (
        <div className="mt-4">
          <Pagination page={data.number} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}

      {/* Create / edit form */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editTarget ? `Edit ${editTarget.code}` : 'New coupon'}
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
          <Field label="Code" required error={errors.code} className="sm:col-span-2">
            <Input
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              invalid={!!errors.code}
              placeholder="WELCOME10"
            />
          </Field>
          <Field label="Type" required error={errors.type}>
            <Select value={form.type} onChange={(e) => set('type', e.target.value as CouponType)}>
              <option value="PERCENT">Percent (%)</option>
              <option value="FIXED">Fixed amount</option>
            </Select>
          </Field>
          <Field
            label={form.type === 'PERCENT' ? 'Value (%)' : `Value (${currency})`}
            required
            error={errors.value}
            hint={form.type === 'PERCENT' ? '1–100' : undefined}
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.value}
              onChange={(e) => set('value', e.target.value)}
              invalid={!!errors.value}
            />
          </Field>
          <Field label="Minimum order" error={errors.minOrderAmount} hint="Optional">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.minOrderAmount}
              onChange={(e) => set('minOrderAmount', e.target.value)}
            />
          </Field>
          <Field label="Max redemptions" error={errors.maxRedemptions} hint="Optional · blank = unlimited">
            <Input
              type="number"
              min="1"
              value={form.maxRedemptions}
              onChange={(e) => set('maxRedemptions', e.target.value)}
            />
          </Field>
          <Field label="Starts at" error={errors.startsAt} hint="Optional">
            <Input type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </Field>
          <Field label="Ends at" error={errors.endsAt} hint="Optional">
            <Input type="datetime-local" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
          </Field>
          <Field label="Per-user limit" error={errors.perUserLimit} hint="Optional · blank = unlimited">
            <Input
              type="number"
              min="1"
              value={form.perUserLimit}
              onChange={(e) => set('perUserLimit', e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
              className="h-4 w-4 accent-gold-400"
            />
            Active (available at checkout)
          </label>
        </div>
      </Modal>

      {/* Deactivate confirmation */}
      <ConfirmDialog
        open={deactivateTarget != null}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate this coupon?"
        description={
          deactivateTarget
            ? `${deactivateTarget.code} will stop working at checkout. You can re-activate it later by editing it.`
            : undefined
        }
        confirmLabel="Deactivate"
        destructive
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
      />

      {/* Delete confirmation (ADMIN only) */}
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this coupon?"
        description={
          deleteTarget
            ? `Permanently delete ${deleteTarget.code}. If it has ever been redeemed this will fail — deactivate it instead.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
