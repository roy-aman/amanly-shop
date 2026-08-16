import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CreditCard, Globe, MessageCircle, Plus, Search } from 'lucide-react';
import { platformStores } from '@/api/platform';
import { ApiError } from '@/lib/http';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { formatDate } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PasswordInput,
  SearchInput,
  SkeletonTable,
} from '@/components/ui';
import type { CreateStoreRequest, StoreAdminSummaryResponse, StoreStatus } from '@/lib/types';

const STATUS_TONE: Record<StoreStatus, Parameters<typeof Badge>[0]['tone']> = {
  ACTIVE: 'green',
  SUSPENDED: 'amber',
  CLOSED: 'gray',
};

const EMPTY_FORM = {
  slug: '',
  name: '',
  currency: 'INR',
  customDomain: '',
  /** Newline-separated. A shop reached from a developer's machine and from its
   *  live domain is one store, so both addresses can be given at creation. */
  additionalDomains: '',
  adminEmail: '',
  adminFullName: '',
  adminPassword: '',
};

/** One address per line, blanks dropped. Null rather than [] when empty, so the
 *  request carries nothing at all rather than an empty list. */
function extraAddresses(raw: string): string[] | null {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : null;
}

/** Slug rules mirror the backend's: lowercase, digits and hyphens. Derived from
 *  the name only until the operator edits it — a slug cannot be changed later. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function PlatformStores() {
  useDocumentTitle('Stores');
  const qc = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const storesQuery = useQuery({ queryKey: ['platform-stores'], queryFn: platformStores.list });

  const stores = useMemo(() => {
    const all = storesQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q));
  }, [storesQuery.data, search]);

  const createMutation = useMutation({
    mutationFn: (body: CreateStoreRequest) => platformStores.create(body),
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: ['platform-stores'] });
      setCreateOpen(false);
      setForm({ ...EMPTY_FORM });
      setSlugTouched(false);
      setErrors({});
      toast.success(`${created.name} created`, `Answering on ${form.customDomain.trim()}.`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.hasFieldErrors()) {
        setErrors(e.fieldErrorMap());
        return;
      }
      if (e instanceof ApiError && e.code === 'STORE_SLUG_EXISTS') {
        setErrors({ slug: 'That slug is already taken by another store.' });
        return;
      }
      if (e instanceof ApiError && (e.code === 'STORE_DOMAIN_TAKEN' || e.code === 'DOMAIN_TAKEN')) {
        setErrors({ customDomain: 'That address already belongs to a store. No store was created.' });
        return;
      }
      toast.error('Could not create the store', e instanceof Error ? e.message : 'Please try again.');
    },
  });

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.slug.trim()) next.slug = 'Slug is required';
    else if (!/^[a-z0-9-]+$/.test(form.slug.trim())) next.slug = 'Lowercase letters, digits and hyphens only';
    // Required by the API since 2026-08-16, and for a reason worth catching here:
    // a store with no address is unreachable, and every request meant for it is
    // answered by the fallback store instead.
    if (!form.customDomain.trim()) next.customDomain = 'An address is required — without one the store is unreachable';
    // The API rejects an admin email without a password (ADMIN_PASSWORD_REQUIRED);
    // catching it here keeps the operator out of a round trip.
    if (form.adminEmail.trim() && !form.adminPassword) next.adminPassword = 'Required when an admin email is given';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    createMutation.mutate({
      slug: form.slug.trim(),
      name: form.name.trim(),
      currency: form.currency.trim() || undefined,
      customDomain: form.customDomain.trim(),
      additionalDomains: extraAddresses(form.additionalDomains),
      adminEmail: form.adminEmail.trim() || null,
      adminFullName: form.adminFullName.trim() || null,
      adminPassword: form.adminPassword || null,
    });
  }

  return (
    <>
      <PageHeader
        title="Stores"
        subtitle="Every shop running on this platform."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New store
          </Button>
        }
      />

      <div className="mb-5 max-w-sm">
        <SearchInput onSearch={setSearch} placeholder="Search name or slug…" aria-label="Search stores" />
      </div>

      {storesQuery.isLoading ? (
        <SkeletonTable rows={4} />
      ) : storesQuery.isError ? (
        <EmptyState
          title="Could not load stores"
          message={(storesQuery.error as Error)?.message}
          action={<Button onClick={() => storesQuery.refetch()}>Try again</Button>}
        />
      ) : stores.length === 0 ? (
        <EmptyState
          icon={search ? <Search className="h-10 w-10 text-slate-500" /> : <Building2 className="h-10 w-10 text-slate-500" />}
          title={search ? 'No store matches that' : 'No stores yet'}
          message={search ? 'Try a different name or slug.' : 'Create the first store to get the platform going.'}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New store"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-store" loading={createMutation.isPending}>
              Create store
            </Button>
          </>
        }
      >
        <form id="create-store" onSubmit={onSubmit} className="space-y-4" noValidate>
          {/* Explicit aria-labels throughout: the shared Field renders a bare
              <label> with no htmlFor, so the controls would otherwise be
              announced unnamed. */}
          <Field label="Store name" required error={errors.name}>
            <Input
              aria-label="Store name"
              value={form.name}
              invalid={!!errors.name}
              onChange={(e) => {
                set('name', e.target.value);
                if (!slugTouched) set('slug', slugify(e.target.value));
              }}
            />
          </Field>

          <Field
            label="Slug"
            required
            error={errors.slug}
            hint="Permanent — it appears in URLs and may be referenced by DNS."
          >
            <Input
              aria-label="Slug"
              value={form.slug}
              invalid={!!errors.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value);
              }}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Currency" hint="Defaults to INR.">
              <Input aria-label="Currency" value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} maxLength={3} />
            </Field>
            <Field
              label="Address"
              required
              error={errors.customDomain}
              hint="Where this store answers. A domain, or a development address while its UI has no domain yet. Also grants the custom-domain entitlement."
            >
              <Input
                aria-label="Address"
                value={form.customDomain}
                invalid={!!errors.customDomain}
                placeholder="novasports.in or http://localhost:5180"
                onChange={(e) => set('customDomain', e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Other addresses"
            error={errors.additionalDomains}
            hint="Optional, one per line. A shop reached from a developer's machine and from its live domain is one store — give both here and either will find it."
          >
            <textarea
              aria-label="Other addresses"
              rows={2}
              value={form.additionalDomains}
              placeholder={'http://localhost:5180\nwww.novasports.in'}
              onChange={(e) => set('additionalDomains', e.target.value)}
              className="block w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-body-sm text-slate-100 placeholder:text-slate-600 focus:border-primary focus:outline-none"
            />
          </Field>

          <div className="rounded-lg border border-ink-700 bg-ink-850 p-4">
            <p className="text-body-sm font-medium text-slate-100">First administrator</p>
            <p className="mt-1 text-caption text-slate-400">
              A store with no administrator cannot be signed into and stays inert. Adding one here is the only way to
              create it in the same step.
            </p>
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Admin email" error={errors.adminEmail}>
                  <Input
                    type="email"
                    aria-label="Admin email"
                    value={form.adminEmail}
                    invalid={!!errors.adminEmail}
                    onChange={(e) => set('adminEmail', e.target.value)}
                  />
                </Field>
                <Field label="Admin full name">
                  <Input aria-label="Admin full name" value={form.adminFullName} onChange={(e) => set('adminFullName', e.target.value)} />
                </Field>
              </div>
              <Field
                label="Admin password"
                error={errors.adminPassword}
                hint="12–72 characters with lower, upper, a digit and a symbol."
              >
                <PasswordInput
                  aria-label="Admin password"
                  value={form.adminPassword}
                  invalid={!!errors.adminPassword}
                  onChange={(e) => set('adminPassword', e.target.value)}
                />
              </Field>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Shows the two flag families side by side: what the platform allows, and what
 *  the merchant actually has working. An operator debugging "why can't they take
 *  payments" needs to see which half is missing. */
function StoreCard({ store }: { store: StoreAdminSummaryResponse }) {
  const capabilities = [
    {
      icon: CreditCard,
      label: 'Online payments',
      allowed: store.onlinePaymentsAllowed,
      configured: store.onlinePaymentConfigured,
    },
    {
      icon: MessageCircle,
      label: 'WhatsApp',
      allowed: store.whatsappNotificationsAllowed,
      configured: store.whatsappConfigured,
    },
    { icon: Globe, label: 'Custom domain', allowed: store.customDomainAllowed, configured: null },
  ];

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/platform/stores/${store.id}`}
            className="block truncate text-h4 text-slate-100 underline-offset-4 hover:underline"
          >
            {store.name}
          </Link>
          <p className="mt-0.5 truncate text-caption text-slate-500">
            {store.slug} · {store.currency} · since {formatDate(store.createdAt)}
          </p>
        </div>
        <Badge tone={STATUS_TONE[store.status]}>{store.status}</Badge>
      </div>

      <ul className="space-y-1.5">
        {capabilities.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-body-sm">
            <c.icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <span className="text-slate-300">{c.label}</span>
            <span className="ml-auto text-caption">
              {!c.allowed ? (
                <span className="text-slate-500">Not allowed</span>
              ) : c.configured === false ? (
                <span className="text-warning-300">Allowed · not set up</span>
              ) : (
                <span className="text-success-300">{c.configured === null ? 'Allowed' : 'Live'}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-caption text-slate-500">
        {store.maxStaffSeats == null ? 'Unlimited staff seats' : `${store.maxStaffSeats} staff seats`}
      </p>
    </Card>
  );
}
