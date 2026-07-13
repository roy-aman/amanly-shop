import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPublicStore } from '@/api/store';
import { getCart } from '@/api/cart';
import { placeOrder, verifyRazorpayPayment } from '@/api/orders';
import { addAddress, listAddresses } from '@/api/addresses';
import { loadRazorpay } from '@/lib/razorpay';
import { ApiError } from '@/lib/http';
import { money } from '@/lib/format';
import type { AddressResponse, PaymentMethod, ShippingDetails } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { Button, Card, Field, Input, Textarea, Select, PageLoader, PageHeader } from '@/components/ui';

interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

const EMPTY_FORM = {
  name: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  notes: '',
};

export default function Checkout() {
  const navigate = useNavigate();
  const { refresh } = useCart();
  const toast = useToast();

  const storeQuery = useQuery({ queryKey: ['public-store'], queryFn: getPublicStore });
  const cartQuery = useQuery({ queryKey: ['cart'], queryFn: getCart });
  const addressesQuery = useQuery({ queryKey: ['addresses'], queryFn: listAddresses });

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [saveAddress, setSaveAddress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const savedAddresses = addressesQuery.data ?? [];

  const store = storeQuery.data;
  const cart = cartQuery.data;

  // Payment methods available from store config.
  const methods = useMemo(() => {
    const opts: { value: PaymentMethod; label: string; desc: string }[] = [];
    if (store?.codEnabled) opts.push({ value: 'CASH', label: 'Cash on Delivery', desc: 'Pay when your order arrives' });
    if (store?.onlinePaymentEnabled)
      opts.push({ value: 'UPI', label: 'UPI / Online payment', desc: 'Pay securely now via UPI, cards & more' });
    if (opts.length === 0) opts.push({ value: 'CASH', label: 'Cash on Delivery', desc: 'Pay when your order arrives' });
    return opts;
  }, [store]);

  // Prefill from the default (or first) saved address once they load.
  useEffect(() => {
    if (selectedAddressId || savedAddresses.length === 0) return;
    const def = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    setSelectedAddressId(def.id);
    fillFromAddress(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressesQuery.data]);

  // Default the selected payment method to the first available.
  useEffect(() => {
    if (methods.length) setPaymentMethod(methods[0].value);
  }, [methods]);

  // Redirect to /cart if the cart is empty.
  useEffect(() => {
    if (cartQuery.isSuccess && (!cart || cart.items.length === 0)) {
      navigate('/cart', { replace: true });
    }
  }, [cartQuery.isSuccess, cart, navigate]);

  function fillFromAddress(a: AddressResponse) {
    setForm((f) => ({
      ...f,
      name: a.recipientName,
      phone: a.phone ?? '',
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2 ?? '',
      city: a.city,
      state: a.state ?? '',
      postalCode: a.postalCode,
      country: a.country,
    }));
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.addressLine1.trim()) next.addressLine1 = 'Address is required';
    if (!form.city.trim()) next.city = 'City is required';
    if (!form.postalCode.trim()) next.postalCode = 'Postal code is required';
    if (!form.country.trim()) next.country = 'Country is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildShipping(): ShippingDetails {
    return {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2.trim() || null,
      city: form.city.trim(),
      state: form.state.trim() || null,
      postalCode: form.postalCode.trim(),
      country: form.country.trim(),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const shippingAddress = buildShipping();
    setSubmitting(true);
    try {
      const order = await placeOrder({ shippingAddress, notes: form.notes.trim() || null, paymentMethod });

      if (saveAddress) {
        const s = shippingAddress;
        // Best-effort — a failure to save the address must not fail the placed order.
        void addAddress({
          label: s.city || s.name || 'Address',
          recipientName: s.name,
          phone: s.phone,
          addressLine1: s.addressLine1,
          addressLine2: s.addressLine2,
          city: s.city,
          state: s.state,
          postalCode: s.postalCode,
          country: s.country,
          makeDefault: false,
        }).catch(() => undefined);
      }

      if (!order.paymentAction) {
        // COD — order complete.
        toast.success('Order placed!', 'Thank you — your order has been received.');
        await refresh();
        navigate(`/orders/${order.id}`);
        return;
      }

      // Online payment — hand off to Razorpay.
      const pa = order.paymentAction;
      try {
        await loadRazorpay();
      } catch {
        setSubmitting(false);
        toast.error('Payment unavailable', 'Could not load the payment gateway. Please try again.');
        return;
      }
      if (!window.Razorpay) {
        setSubmitting(false);
        toast.error('Payment unavailable', 'Could not load the payment gateway. Please try again.');
        return;
      }

      const rzp = new window.Razorpay({
        key: pa.razorpayKeyId,
        order_id: pa.razorpayOrderId,
        amount: pa.amountMinor,
        currency: pa.currency,
        name: store?.name ?? 'Royal Commerce',
        description: `Order ${order.id}`,
        prefill: { name: shippingAddress.name, contact: shippingAddress.phone ?? '' },
        theme: { color: '#e0b040' },
        handler: async (resp: RazorpayHandlerResponse) => {
          try {
            await verifyRazorpayPayment({
              orderId: order.id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpayOrderId: resp.razorpay_order_id,
              razorpaySignature: resp.razorpay_signature,
            });
            toast.success('Payment successful!', 'Thank you — your order is confirmed.');
            await refresh();
            navigate(`/orders/${order.id}`);
          } catch (err) {
            setSubmitting(false);
            toast.error('Payment verification failed', err instanceof Error ? err.message : 'Please contact support if you were charged.');
          }
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
            toast.info('Payment not completed', 'Your order is saved as pending — you can pay later.');
          },
        },
      });
      rzp.open();
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.hasFieldErrors()) {
        setErrors(err.fieldErrorMap());
      } else {
        toast.error('Could not place order', err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    }
  }

  if (storeQuery.isLoading || cartQuery.isLoading) return <PageLoader />;
  if (!cart || cart.items.length === 0) return <PageLoader />;

  const currency = cart.currency;

  return (
    <div className="space-y-6">
      <PageHeader title="Checkout" subtitle="Enter your shipping details to complete the order." />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Shipping */}
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-200">Shipping details</h2>
              {savedAddresses.length > 0 && (
                <Select
                  value={selectedAddressId}
                  onChange={(e) => {
                    setSelectedAddressId(e.target.value);
                    const a = savedAddresses.find((x) => x.id === e.target.value);
                    if (a) fillFromAddress(a);
                  }}
                  className="max-w-[220px]"
                >
                  <option value="">Use a saved address…</option>
                  {savedAddresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                      {a.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" required error={errors.name}>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} invalid={!!errors.name} autoComplete="name" />
              </Field>
              <Field label="Phone" error={errors.phone}>
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" />
              </Field>
              <Field label="Address line 1" required error={errors.addressLine1} className="sm:col-span-2">
                <Input
                  value={form.addressLine1}
                  onChange={(e) => set('addressLine1', e.target.value)}
                  invalid={!!errors.addressLine1}
                  autoComplete="address-line1"
                />
              </Field>
              <Field label="Address line 2" error={errors.addressLine2} className="sm:col-span-2">
                <Input value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} autoComplete="address-line2" />
              </Field>
              <Field label="City" required error={errors.city}>
                <Input value={form.city} onChange={(e) => set('city', e.target.value)} invalid={!!errors.city} autoComplete="address-level2" />
              </Field>
              <Field label="State / Region" error={errors.state}>
                <Input value={form.state} onChange={(e) => set('state', e.target.value)} autoComplete="address-level1" />
              </Field>
              <Field label="Postal code" required error={errors.postalCode}>
                <Input
                  value={form.postalCode}
                  onChange={(e) => set('postalCode', e.target.value)}
                  invalid={!!errors.postalCode}
                  autoComplete="postal-code"
                />
              </Field>
              <Field label="Country" required error={errors.country}>
                <Input value={form.country} onChange={(e) => set('country', e.target.value)} invalid={!!errors.country} autoComplete="country-name" />
              </Field>
              <Field label="Order notes" error={errors.notes} className="sm:col-span-2">
                <Textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  maxLength={1000}
                  placeholder="Delivery instructions, landmarks, etc. (optional)"
                />
              </Field>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={saveAddress}
                onChange={(e) => setSaveAddress(e.target.checked)}
                className="h-4 w-4 accent-gold-400"
              />
              Save this address to my address book
            </label>
          </Card>

          {/* Payment method */}
          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-slate-200">Payment method</h2>
            <div className="space-y-2">
              {methods.map((m) => (
                <label
                  key={m.value}
                  className={
                    'flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ' +
                    (paymentMethod === m.value ? 'border-gold-400/50 bg-gold-400/5' : 'border-ink-700 hover:border-ink-500')
                  }
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      value={m.value}
                      checked={paymentMethod === m.value}
                      onChange={() => setPaymentMethod(m.value)}
                      className="h-4 w-4 accent-gold-400"
                    />
                    <span className="text-sm font-medium text-slate-100">{m.label}</span>
                  </span>
                  <span className="text-xs text-slate-500">{m.desc}</span>
                </label>
              ))}
            </div>
          </Card>
        </div>

        {/* Order summary */}
        <aside>
          <Card className="space-y-4 p-5">
            <h2 className="text-sm font-semibold text-slate-200">Order summary</h2>
            <div className="space-y-2">
              {cart.items.map((i) => (
                <div key={i.cartItemId} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 text-slate-300">
                    {i.productName} <span className="text-slate-500">× {i.quantity}</span>
                  </span>
                  <span className="shrink-0 text-slate-200">{money(i.subtotal, currency)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-ink-800 pt-4 text-base font-bold">
              <span className="text-slate-300">Total</span>
              <span className="text-gold-300">{money(cart.totalAmount, currency)}</span>
            </div>
            <Button type="submit" fullWidth size="lg" loading={submitting}>
              Place order
            </Button>
          </Card>
        </aside>
      </form>
    </div>
  );
}
