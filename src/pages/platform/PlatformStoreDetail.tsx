import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Globe, Plus, Star, Trash2, Users } from 'lucide-react';
import { platformDomains, platformStoreUsers, platformStores } from '@/api/platform';
import { ApiError } from '@/lib/http';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { formatDate } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  PageLoader,
  Select,
} from '@/components/ui';
import type {
  RoleName,
  StoreAdminSummaryResponse,
  StoreDomainResponse,
  StoreStatus,
  UpdateStoreEntitlementsRequest,
} from '@/lib/types';

const STATUS_TONE: Record<StoreStatus, Parameters<typeof Badge>[0]['tone']> = {
  ACTIVE: 'green',
  SUSPENDED: 'amber',
  CLOSED: 'gray',
};

/** The switches, in the order the platform guide lists them. WhatsApp commerce
 *  depends on notifications; the form mirrors that rather than letting the API
 *  reject the combination. */
const ENTITLEMENTS = [
  {
    key: 'onlinePaymentsAllowed',
    label: 'Online payments',
    help: 'Card and UPI. Withdrawing this drops the store to cash on delivery immediately; their Razorpay keys are kept, so re-granting restores the setup.',
  },
  { key: 'whatsappNotificationsAllowed', label: 'WhatsApp notifications', help: 'Order updates sent over WhatsApp.' },
  {
    key: 'whatsappCommerceAllowed',
    label: 'WhatsApp commerce',
    help: 'Browse and order inside WhatsApp. Requires notifications as well.',
  },
  { key: 'emailNotificationsAllowed', label: 'Order email', help: 'Confirmation, shipped and delivered mail.' },
  {
    key: 'marketingEmailAllowed',
    label: 'Marketing email',
    help: 'Campaigns and abandoned-cart mail. Separate from transactional mail on purpose.',
  },
  { key: 'customDomainAllowed', label: 'Custom domain', help: 'Whether the store may answer on its own hostnames.' },
  {
    key: 'imageUploadAllowed',
    label: 'Image uploads',
    help: 'Whether staff may upload image files rather than only pasting URLs. Costs storage and egress per store. Withdrawing it stops new uploads; images already uploaded keep working.',
  },
  {
    key: 'aiImageGenerationAllowed',
    label: 'AI image generation',
    help: 'Whether staff may generate product imagery from a prompt. Metered apart from uploading: each image is roughly ten seconds of inference rather than a few kilobytes of storage.',
  },
] as const;

const domainsKey = (storeId: string) => ['platform-domains', storeId];

export default function PlatformStoreDetail() {
  const { storeId = '' } = useParams();
  const qc = useQueryClient();

  const storeQuery = useQuery({
    queryKey: ['platform-store', storeId],
    queryFn: () => platformStores.get(storeId),
    enabled: !!storeId,
  });
  const store = storeQuery.data;
  useDocumentTitle(store?.name);

  async function invalidateStore() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['platform-store', storeId] }),
      qc.invalidateQueries({ queryKey: ['platform-stores'] }),
    ]);
  }

  if (storeQuery.isLoading) return <PageLoader />;
  if (storeQuery.isError || !store) {
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
        to="/platform"
        className="mb-4 inline-flex items-center gap-2 text-body-sm text-slate-400 transition hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" /> All stores
      </Link>

      <PageHeader title={store.name} subtitle={`${store.slug} · ${store.currency}`} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Keyed by id so switching stores rebuilds the forms from the new
              store's values instead of keeping the previous one's state. */}
          <EntitlementsCard key={`ent-${store.id}`} store={store} onSaved={invalidateStore} />
          <DomainsCard key={`dom-${store.id}`} store={store} />
          <MembersCard key={`mem-${store.id}`} store={store} />
        </div>
        <div className="space-y-6">
          <StatusCard key={`status-${store.id}`} store={store} onSaved={invalidateStore} />
        </div>
      </div>
    </>
  );
}

function StatusCard({ store, onSaved }: { store: StoreAdminSummaryResponse; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [name, setName] = useState(store.name);
  const [status, setStatus] = useState<StoreStatus>(store.status);

  const mutation = useMutation({
    mutationFn: () => platformStores.update(store.id, { name: name.trim(), status }),
    onSuccess: async () => {
      await onSaved();
      toast.success('Store updated');
    },
    onError: (e) => toast.error('Could not update the store', e instanceof Error ? e.message : 'Please try again.'),
  });

  const dirty = name.trim() !== store.name || status !== store.status;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-h4 text-slate-100">Status</h2>
        <Badge tone={STATUS_TONE[store.status]}>{store.status}</Badge>
      </div>

      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field
        label="Trading status"
        hint="A suspended or closed store answers every request on its domain with a maintenance page. There is no delete — closing is reversible."
      >
        {/* Explicit aria-label: the shared Field renders a bare <label> with no
            htmlFor, so without this the control is announced unnamed. */}
        <Select aria-label="Trading status" value={status} onChange={(e) => setStatus(e.target.value as StoreStatus)}>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CLOSED">Closed</option>
        </Select>
      </Field>

      {status !== 'ACTIVE' && store.status === 'ACTIVE' ? (
        <p className="flex items-start gap-2 rounded-lg border border-warning-300/40 bg-warning-500/10 p-3 text-caption text-warning-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Shoppers will see a maintenance page instead of the shop as soon as this is saved.
        </p>
      ) : null}

      <Button fullWidth disabled={!dirty} loading={mutation.isPending} onClick={() => mutation.mutate()}>
        Save changes
      </Button>

      <dl className="space-y-1.5 border-t border-ink-800 pt-4 text-caption">
        <div className="flex justify-between">
          <dt className="text-slate-500">Staff seats</dt>
          <dd className="text-slate-300">{store.maxStaffSeats ?? 'Unlimited'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Cash on delivery</dt>
          <dd className="text-slate-300">{store.codEnabled ? 'On' : 'Off'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Created</dt>
          <dd className="text-slate-300">{formatDate(store.createdAt)}</dd>
        </div>
      </dl>
    </Card>
  );
}

function EntitlementsCard({ store, onSaved }: { store: StoreAdminSummaryResponse; onSaved: () => Promise<void> }) {
  const qc = useQueryClient();
  const toast = useToast();

  // The endpoint applies every field as sent, so the form seeds from the current
  // values and always submits the whole object — a partial patch would silently
  // switch off whatever it omitted.
  const [form, setForm] = useState<UpdateStoreEntitlementsRequest>(() => ({
    onlinePaymentsAllowed: store.onlinePaymentsAllowed,
    whatsappNotificationsAllowed: store.whatsappNotificationsAllowed,
    whatsappCommerceAllowed: store.whatsappCommerceAllowed,
    emailNotificationsAllowed: store.emailNotificationsAllowed,
    marketingEmailAllowed: store.marketingEmailAllowed,
    customDomainAllowed: store.customDomainAllowed,
    imageUploadAllowed: store.imageUploadAllowed,
    aiImageGenerationAllowed: store.aiImageGenerationAllowed,
    maxStaffSeats: store.maxStaffSeats,
    maxImageUploads: store.maxImageUploads,
    maxAiImageGenerations: store.maxAiImageGenerations,
  }));
  const [confirmDetach, setConfirmDetach] = useState(false);

  const domainsQuery = useQuery({ queryKey: domainsKey(store.id), queryFn: () => platformDomains.list(store.id) });
  const domains = domainsQuery.data ?? [];

  const mutation = useMutation({
    mutationFn: () => platformStores.updateEntitlements(store.id, form),
    onSuccess: async () => {
      await Promise.all([onSaved(), qc.invalidateQueries({ queryKey: domainsKey(store.id) })]);
      setConfirmDetach(false);
      toast.success('Entitlements saved');
    },
    onError: (e) => {
      setConfirmDetach(false);
      toast.error('Could not save entitlements', e instanceof Error ? e.message : 'Please try again.');
    },
  });

  function set(key: (typeof ENTITLEMENTS)[number]['key'], value: boolean) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'whatsappNotificationsAllowed' && !value) next.whatsappCommerceAllowed = false;
      if (key === 'whatsappCommerceAllowed' && value) next.whatsappNotificationsAllowed = true;
      return next;
    });
  }

  // The one destructive withdrawal: it detaches every hostname the store holds.
  const willDetachDomains = store.customDomainAllowed && !form.customDomainAllowed && domains.length > 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (willDetachDomains) {
      setConfirmDetach(true);
      return;
    }
    mutation.mutate();
  }

  return (
    <Card className="p-5">
      <h2 className="text-h4 text-slate-100">Entitlements</h2>
      <p className="mt-1 text-body-sm text-slate-400">
        What this store is allowed to use. Withdrawing a capability takes effect immediately and keeps the
        merchant&apos;s own configuration, so re-granting restores it.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-1">
        {ENTITLEMENTS.map((ent) => (
          <label
            key={ent.key}
            className="flex cursor-pointer items-start gap-3 rounded-lg p-3 transition hover:bg-ink-800/60"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-gold-400"
              checked={form[ent.key]}
              onChange={(e) => set(ent.key, e.target.checked)}
            />
            <span className="min-w-0">
              <span className="block text-body-sm font-medium text-slate-100">{ent.label}</span>
              <span className="block text-caption text-slate-400">{ent.help}</span>
            </span>
          </label>
        ))}

        <div className="px-3 pt-3">
          <Field
            label="Staff seats"
            hint="Maximum STAFF and ADMIN members. Leave empty for unlimited."
            className="max-w-[16rem]"
          >
            <Input
              type="number"
              min={1}
              aria-label="Staff seats"
              value={form.maxStaffSeats ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  // Empty means unlimited (null); 0 is never a valid seat count.
                  ...f,
                  maxStaffSeats: e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
                }))
              }
            />
          </Field>
        </div>

        <div className="px-3 pt-3">
          <Field
            label="Image upload limit"
            hint="Total images this store may upload. Leave empty for unlimited. To stop uploading altogether, switch the entitlement off above rather than setting a limit of zero."
            className="max-w-[16rem]"
          >
            <Input
              type="number"
              min={1}
              aria-label="Image upload limit"
              disabled={!form.imageUploadAllowed}
              value={form.maxImageUploads ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  // Empty means unlimited (null); the API rejects 0.
                  ...f,
                  maxImageUploads: e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
                }))
              }
            />
          </Field>
        </div>

        <div className="px-3 pt-3">
          <Field
            label="AI image limit"
            hint="Total images this store may generate. Leave empty for unlimited. To stop generation altogether, switch the entitlement off above rather than setting a limit of zero."
            className="max-w-[16rem]"
          >
            <Input
              type="number"
              min={1}
              aria-label="AI image limit"
              disabled={!form.aiImageGenerationAllowed}
              value={form.maxAiImageGenerations ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  // Empty means unlimited (null); the API rejects 0.
                  ...f,
                  maxAiImageGenerations:
                    e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
                }))
              }
            />
          </Field>
        </div>

        <div className="pt-3">
          <Button type="submit" loading={mutation.isPending}>
            Save entitlements
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDetach}
        onOpenChange={setConfirmDetach}
        destructive
        title="Detach every domain?"
        description={`Turning off the custom-domain entitlement removes ${domains
          .map((d) => d.hostname)
          .join(', ')} from this store. Shoppers reaching the shop on ${
          domains.length === 1 ? 'that hostname' : 'those hostnames'
        } will no longer find it.`}
        confirmLabel="Detach and save"
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
      />
    </Card>
  );
}

function DomainsCard({ store }: { store: StoreAdminSummaryResponse }) {
  const qc = useQueryClient();
  const toast = useToast();

  const [hostname, setHostname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<StoreDomainResponse | null>(null);

  const domainsQuery = useQuery({ queryKey: domainsKey(store.id), queryFn: () => platformDomains.list(store.id) });
  const domains = domainsQuery.data ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: domainsKey(store.id) });

  const addMutation = useMutation({
    // The first hostname a store gets becomes primary whatever we ask for; being
    // explicit keeps the request honest about the intent.
    mutationFn: () => platformDomains.add(store.id, { hostname: hostname.trim(), makePrimary: domains.length === 0 }),
    onSuccess: async (created) => {
      await refresh();
      setHostname('');
      setError(null);
      // Hostnames are normalised server-side, so report what was actually stored
      // rather than echoing what was typed.
      toast.success(`${created.hostname} attached`, created.primary ? 'It is now the primary domain.' : undefined);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'CUSTOM_DOMAIN_NOT_ALLOWED') {
        setError('This store is not entitled to custom domains — grant it above first.');
        return;
      }
      if (e instanceof ApiError && (e.code === 'DOMAIN_TAKEN' || e.code === 'STORE_DOMAIN_TAKEN')) {
        setError('That hostname already belongs to a store.');
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not attach that hostname.');
    },
  });

  const primaryMutation = useMutation({
    mutationFn: (domainId: string) => platformDomains.makePrimary(store.id, domainId),
    onSuccess: async () => {
      await refresh();
      toast.success('Primary domain updated');
    },
    onError: (e) => toast.error('Could not change the primary', e instanceof Error ? e.message : 'Please try again.'),
  });

  const removeMutation = useMutation({
    mutationFn: (domainId: string) => platformDomains.remove(store.id, domainId),
    onSuccess: async () => {
      await refresh();
      setPendingRemoval(null);
      toast.success('Domain removed');
    },
    onError: (e) => {
      setPendingRemoval(null);
      if (e instanceof ApiError && e.code === 'CANNOT_REMOVE_PRIMARY_DOMAIN') {
        toast.error('Promote another domain first', 'The primary cannot be removed while others remain.');
        return;
      }
      toast.error('Could not remove the domain', e instanceof Error ? e.message : 'Please try again.');
    },
  });

  return (
    <Card className="p-5">
      <h2 className="text-h4 text-slate-100">Domains</h2>
      <p className="mt-1 text-body-sm text-slate-400">
        The hostnames this store answers on. The primary is its canonical address — order email, invoices and reset
        links point there. Nothing here checks DNS or issues a certificate.
      </p>

      {!store.customDomainAllowed ? (
        <p className="mt-4 rounded-lg border border-ink-700 bg-ink-850 p-3 text-caption text-slate-400">
          Custom domains are switched off for this store. Grant the entitlement above to attach one.
        </p>
      ) : null}

      <ul className="mt-4 divide-y divide-ink-800">
        {domains.length === 0 ? (
          <li className="py-6 text-center text-body-sm text-slate-500">
            No hostnames yet — the store is reachable at its slug only.
          </li>
        ) : (
          domains.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <Globe className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-body-sm text-slate-200">{d.hostname}</span>
              {d.primary ? <Badge tone="gold">Primary</Badge> : null}
              {!d.primary ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={primaryMutation.isPending}
                  onClick={() => primaryMutation.mutate(d.id)}
                >
                  <Star className="h-4 w-4" /> Make primary
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" aria-label={`Remove ${d.hostname}`} onClick={() => setPendingRemoval(d)}>
                <Trash2 className="h-4 w-4 text-danger-300" />
              </Button>
            </li>
          ))
        )}
      </ul>

      <form
        className="mt-4 flex flex-wrap items-start gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (hostname.trim()) addMutation.mutate();
        }}
      >
        <Field error={error} className="min-w-[16rem] flex-1">
          <Input
            value={hostname}
            invalid={!!error}
            placeholder="novasports.in"
            aria-label="Hostname"
            onChange={(e) => {
              setHostname(e.target.value);
              setError(null);
            }}
            disabled={!store.customDomainAllowed}
          />
        </Field>
        <Button
          type="submit"
          variant="secondary"
          loading={addMutation.isPending}
          disabled={!store.customDomainAllowed || !hostname.trim()}
        >
          <Plus className="h-4 w-4" /> Attach
        </Button>
      </form>

      <ConfirmDialog
        open={!!pendingRemoval}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
        destructive
        title={`Remove ${pendingRemoval?.hostname ?? ''}?`}
        description="Shoppers reaching the shop on this hostname will no longer find it."
        confirmLabel="Remove"
        loading={removeMutation.isPending}
        onConfirm={() => pendingRemoval && removeMutation.mutate(pendingRemoval.id)}
      />
    </Card>
  );
}

/**
 * A pointer to the members screen, not the screen itself.
 *
 * Searching, filtering and role changes moved to /platform/stores/:storeId/members
 * so that what is being looked at lives in the URL and can be linked to. What
 * stays here is the one number an operator scanning a store wants — how many
 * people it has — and the way in.
 */
function MembersCard({ store }: { store: StoreAdminSummaryResponse }) {
  // size=1 because only the count is rendered; the page itself fetches the rows.
  const membersQuery = useQuery({
    queryKey: ['platform-store-users', store.id, '', 0, 1],
    queryFn: () => platformStoreUsers.list(store.id, { page: 0, size: 1 }),
  });
  const total = membersQuery.data?.totalElements;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h4 text-slate-100">Members</h2>
          <p className="mt-1 text-body-sm text-slate-400">
            Everyone with a membership of this store, and what they may do here. A person&apos;s roles are per store —
            changing them affects this shop only, never the same account at another. Platform operators are not listed
            as staff and cannot be edited here.
          </p>
        </div>
        <Link to={`/platform/stores/${store.id}/members`}>
          <Button variant="secondary">
            <Users className="h-4 w-4" /> Manage members
          </Button>
        </Link>
      </div>

      <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-ink-800 pt-4">
        <div>
          <dt className="text-caption text-slate-500">Members</dt>
          <dd className="text-h4 text-slate-100">
            {membersQuery.isLoading ? '—' : membersQuery.isError ? 'Unavailable' : total}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-slate-500">Staff seats</dt>
          <dd className="text-h4 text-slate-100">{store.maxStaffSeats ?? 'Unlimited'}</dd>
        </div>
      </dl>
    </Card>
  );
}
