import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, MessageCircle } from 'lucide-react';
import { adminStore } from '@/api/admin';
import { ApiError } from '@/lib/http';
import type {
  StoreSettingsResponse,
  UpdatePaymentSettingsRequest,
  UpdateWhatsappSettingsRequest,
} from '@/lib/types';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, PageLoader } from '@/components/ui';

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
      <PageHeader title="Settings" subtitle="Payment and messaging integrations for your store." />
      <div className="space-y-6">
        <PaymentsCard store={data} />
        <WhatsappCard store={data} />
      </div>
    </div>
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
