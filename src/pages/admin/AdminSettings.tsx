import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, MessageCircle, Truck, Type } from 'lucide-react';
import { adminStore } from '@/api/admin';
import { ApiError } from '@/lib/http';
import type {
  StoreSettingsResponse,
  UpdateCommerceSettingsRequest,
  UpdatePaymentSettingsRequest,
  UpdateStorefrontContentRequest,
  UpdateWhatsappSettingsRequest,
} from '@/lib/types';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, PageLoader, Textarea } from '@/components/ui';

export default function AdminSettings() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'store'],
    queryFn: () => adminStore.get(),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !data) {
    return <EmptyState title="Could not load settings" message={(error as Error)?.message} />;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Delivery, tax, payment and messaging for your store." />
      <div className="space-y-6">
        <StorefrontCard store={data} />
        <CommerceCard store={data} />
        <PaymentsCard store={data} />
        <WhatsappCard store={data} />
      </div>
    </div>
  );
}

// ── Storefront opening screen ─────────────────────────────────────────
/**
 * The three lines on the shop's first screen.
 *
 * Empty is not the same as blank here: an empty field means "use the default",
 * and the default is shown as placeholder text so a merchant can see what they
 * are replacing — and get it back by clearing the box. Pre-filling the inputs
 * with the default would make that impossible to express.
 */
const HERO_DEFAULTS = {
  eyebrow: 'Considered essentials for men.',
  headline: 'Fewer things.\nBetter made.',
  subtext: 'A tight edit of everyday pieces — chosen for fit, fabric, and how they wear over time.',
};

function StorefrontCard({ store }: { store: StoreSettingsResponse }) {
  const qc = useQueryClient();
  const toast = useToast();

  const [eyebrow, setEyebrow] = useState(store.heroEyebrow ?? '');
  const [headline, setHeadline] = useState(store.heroHeadline ?? '');
  const [subtext, setSubtext] = useState(store.heroSubtext ?? '');

  useEffect(() => {
    setEyebrow(store.heroEyebrow ?? '');
    setHeadline(store.heroHeadline ?? '');
    setSubtext(store.heroSubtext ?? '');
  }, [store]);

  const mutation = useMutation({
    mutationFn: (body: UpdateStorefrontContentRequest) => adminStore.updateStorefrontContent(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'store'] });
      // The storefront reads these from the public bootstrap, which is cached for
      // minutes — without this the merchant reloads the shop and sees the old words.
      qc.invalidateQueries({ queryKey: ['public-store'] });
      toast.success('Storefront copy saved');
    },
    onError: (e) => toast.error('Could not save', e instanceof Error ? e.message : 'Please try again.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ heroEyebrow: eyebrow, heroHeadline: headline, heroSubtext: subtext });
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Type className="h-4 w-4 text-gold-400" /> Storefront opening screen
      </h2>
      <p className="mt-1 text-caption text-slate-400">
        The words shoppers see first. Leave a box empty to use the wording shown in grey. These
        appear only while no home-page banner is running — a live banner takes the first screen
        instead.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <Field label="Small line above" hint="A short line of context.">
          <Input
            aria-label="Small line above"
            maxLength={120}
            placeholder={HERO_DEFAULTS.eyebrow}
            value={eyebrow}
            onChange={(e) => setEyebrow(e.target.value)}
          />
        </Field>

        <Field label="Headline" hint="Each new line becomes its own line on the page.">
          <Textarea
            aria-label="Headline"
            rows={2}
            maxLength={200}
            placeholder={HERO_DEFAULTS.headline}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </Field>

        <Field label="Sentence underneath">
          <Textarea
            aria-label="Sentence underneath"
            rows={2}
            maxLength={400}
            placeholder={HERO_DEFAULTS.subtext}
            value={subtext}
            onChange={(e) => setSubtext(e.target.value)}
          />
        </Field>

        <Button type="submit" loading={mutation.isPending}>
          Save copy
        </Button>
      </form>
    </Card>
  );
}

// ── Delivery & tax (WP-P.6) ───────────────────────────────────────────
function CommerceCard({ store }: { store: StoreSettingsResponse }) {
  const qc = useQueryClient();
  const toast = useToast();

  // Every field is applied as sent, so the form starts from the current values
  // and submits all of them; a partial save would zero what it omitted.
  const [shipping, setShipping] = useState(String(store.shippingFlatAmount ?? 0));
  const [threshold, setThreshold] = useState(store.freeShippingThreshold == null ? '' : String(store.freeShippingThreshold));
  const [taxRate, setTaxRate] = useState(String(store.taxRatePercent ?? 0));
  const [inclusive, setInclusive] = useState(store.pricesIncludeTax ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setShipping(String(store.shippingFlatAmount ?? 0));
    setThreshold(store.freeShippingThreshold == null ? '' : String(store.freeShippingThreshold));
    setTaxRate(String(store.taxRatePercent ?? 0));
    setInclusive(store.pricesIncludeTax ?? true);
  }, [store]);

  const mutation = useMutation({
    mutationFn: (body: UpdateCommerceSettingsRequest) => adminStore.updateCommerce(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'store'] });
      // The public bootstrap carries the same figures, so the storefront's
      // estimates would otherwise keep quoting the old delivery charge.
      qc.invalidateQueries({ queryKey: ['public-store'] });
      toast.success('Delivery & tax saved', 'Applies to future orders; placed orders keep their own figures.');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.hasFieldErrors()) setErrors(e.fieldErrorMap());
      else toast.error('Could not save', e instanceof Error ? e.message : 'Please try again.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const shippingNum = Number(shipping);
    const rateNum = Number(taxRate);
    const thresholdNum = threshold.trim() === '' ? null : Number(threshold);
    if (!Number.isFinite(shippingNum) || shippingNum < 0) next.shipping = 'Must be zero or more';
    if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100) next.taxRate = 'Must be between 0 and 100';
    if (thresholdNum != null && (!Number.isFinite(thresholdNum) || thresholdNum < 0)) {
      next.threshold = 'Must be zero or more, or empty for never free';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    mutation.mutate({
      shippingFlatAmount: shippingNum,
      freeShippingThreshold: thresholdNum,
      taxRatePercent: rateNum,
      pricesIncludeTax: inclusive,
    });
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Truck className="h-4 w-4 text-gold-400" /> Delivery &amp; tax
      </h2>
      <p className="mt-1 text-caption text-slate-400">
        Applies to orders placed from now on. Orders already placed keep the figures snapshotted at the time, so
        changing these never rewrites an invoice.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Delivery charge" error={errors.shipping} hint={`Flat, in ${store.currency}.`}>
            <Input type="number" min={0} step="0.01" value={shipping} invalid={!!errors.shipping} onChange={(e) => setShipping(e.target.value)} />
          </Field>
          <Field
            label="Free delivery over"
            error={errors.threshold}
            hint="Compared against the total after any discount. Empty = never free."
          >
            <Input type="number" min={0} step="0.01" value={threshold} invalid={!!errors.threshold} onChange={(e) => setThreshold(e.target.value)} />
          </Field>
        </div>

        <Field label="Tax rate (%)" error={errors.taxRate}>
          <Input type="number" min={0} max={100} step="0.001" value={taxRate} invalid={!!errors.taxRate} onChange={(e) => setTaxRate(e.target.value)} />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-body-sm font-medium text-slate-300">How prices are entered</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-700 p-3 transition hover:bg-ink-800/60">
            <input type="radio" className="mt-1 accent-gold-400" checked={inclusive} onChange={() => setInclusive(true)} />
            <span>
              <span className="block text-body-sm text-slate-100">Prices include tax</span>
              <span className="block text-caption text-slate-400">
                Shoppers see “incl. tax” and the total is what the price says.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-700 p-3 transition hover:bg-ink-800/60">
            <input type="radio" className="mt-1 accent-gold-400" checked={!inclusive} onChange={() => setInclusive(false)} />
            <span>
              <span className="block text-body-sm text-slate-100">Tax added at checkout</span>
              <span className="block text-caption text-slate-400">
                Shoppers see “+ tax at checkout” and tax is charged on goods and delivery.
              </span>
            </span>
          </label>
        </fieldset>

        <Button type="submit" loading={mutation.isPending}>
          Save delivery &amp; tax
        </Button>
      </form>
    </Card>
  );
}

// ── Payments ──────────────────────────────────────────────────────────
function PaymentsCard({ store }: { store: StoreSettingsResponse }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [codEnabled, setCodEnabled] = useState(store.codEnabled);
  const [onlineEnabled, setOnlineEnabled] = useState(store.onlinePaymentEnabled);
  const [keyId, setKeyId] = useState(store.razorpayKeyId ?? '');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setCodEnabled(store.codEnabled);
    setOnlineEnabled(store.onlinePaymentEnabled);
    setKeyId(store.razorpayKeyId ?? '');
  }, [store]);

  const mutation = useMutation({
    mutationFn: (body: UpdatePaymentSettingsRequest) => adminStore.updatePayment(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'store'] });
      toast.success('Payment settings saved');
      setKeySecret('');
      setWebhookSecret('');
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
        toast.error('Could not save', e.message);
      } else {
        toast.error('Could not save');
      }
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    mutation.mutate({
      codEnabled,
      onlinePaymentEnabled: onlineEnabled,
      razorpayKeyId: keyId.trim() || null,
      razorpayKeySecret: keySecret.trim() || undefined,
      razorpayWebhookSecret: webhookSecret.trim() || undefined,
    });
  }

  return (
    <Card className="p-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <CreditCard className="h-4 w-4 text-gold-400" /> Payments
          </h2>
          <Badge tone={store.razorpayConfigured ? 'green' : 'gray'}>
            {store.razorpayConfigured ? 'Razorpay configured' : 'Razorpay not configured'}
          </Badge>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={codEnabled} onChange={(e) => setCodEnabled(e.target.checked)} />
          Enable cash on delivery (COD)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={onlineEnabled} onChange={(e) => setOnlineEnabled(e.target.checked)} />
          Enable online payments
        </label>

        <Field label="Razorpay Key ID" error={errors.razorpayKeyId}>
          <Input value={keyId} onChange={(e) => setKeyId(e.target.value)} placeholder="rzp_live_…" />
        </Field>
        <Field
          label="Razorpay Key Secret"
          error={errors.razorpayKeySecret}
          hint="Write-only — secrets are never returned. Leave blank to keep current."
        >
          <Input
            type="password"
            value={keySecret}
            onChange={(e) => setKeySecret(e.target.value)}
            placeholder="leave blank to keep current"
            autoComplete="new-password"
          />
        </Field>
        <Field
          label="Razorpay Webhook Secret"
          error={errors.razorpayWebhookSecret}
          hint="Write-only. Leave blank to keep current."
        >
          <Input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="leave blank to keep current"
            autoComplete="new-password"
          />
        </Field>

        <Button type="submit" loading={mutation.isPending}>
          Save payment settings
        </Button>
      </form>
    </Card>
  );
}

// ── WhatsApp ──────────────────────────────────────────────────────────
function WhatsappCard({ store }: { store: StoreSettingsResponse }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [enabled, setEnabled] = useState(store.whatsappEnabled);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setEnabled(store.whatsappEnabled);
  }, [store]);

  const mutation = useMutation({
    mutationFn: (body: UpdateWhatsappSettingsRequest) => adminStore.updateWhatsapp(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'store'] });
      toast.success('WhatsApp settings saved');
      setAccessToken('');
      setAppSecret('');
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
        toast.error('Could not save', e.message);
      } else {
        toast.error('Could not save');
      }
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    mutation.mutate({
      enabled,
      phoneNumberId: phoneNumberId.trim() || undefined,
      verifyToken: verifyToken.trim() || undefined,
      accessToken: accessToken.trim() || undefined,
      appSecret: appSecret.trim() || undefined,
    });
  }

  return (
    <Card className="p-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <MessageCircle className="h-4 w-4 text-emerald-400" /> WhatsApp
          </h2>
          <Badge tone={store.whatsappEnabled ? 'green' : 'gray'}>
            {store.whatsappEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable WhatsApp notifications
        </label>

        <Field label="Phone Number ID" error={errors.phoneNumberId}>
          <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
        </Field>
        <Field label="Verify Token" error={errors.verifyToken}>
          <Input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} />
        </Field>
        <Field
          label="Access Token"
          error={errors.accessToken}
          hint="Write-only — secrets are never returned. Leave blank to keep current."
        >
          <Input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="leave blank to keep current"
            autoComplete="new-password"
          />
        </Field>
        <Field
          label="App Secret"
          error={errors.appSecret}
          hint="Write-only. Leave blank to keep current."
        >
          <Input
            type="password"
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
            placeholder="leave blank to keep current"
            autoComplete="new-password"
          />
        </Field>

        <Button type="submit" loading={mutation.isPending}>
          Save WhatsApp settings
        </Button>
      </form>
    </Card>
  );
}
