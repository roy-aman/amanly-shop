import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CreditCard, MapPin, Plus, Tag, Wallet } from 'lucide-react';
import { getPublicStore } from '@/api/store';
import { getCart } from '@/api/cart';
import { placeOrder, verifyRazorpayPayment } from '@/api/orders';
import { validateCoupon } from '@/api/coupons';
import { addAddress, listAddresses } from '@/api/addresses';
import { loadRazorpay } from '@/lib/razorpay';
import { clearStoredCoupon, getStoredCoupon } from '@/lib/couponStorage';
import { ApiError } from '@/lib/http';
import { money } from '@/lib/format';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { AddressRequest, AddressResponse, PaymentMethod, PlaceOrderRequest, ShippingDetails } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import {
  Button,
  Card,
  Field,
  Input,
  LinkButton,
  PageHeader,
  PageLoader,
  Stepper,
  Textarea,
  type Step,
} from '@/components/ui';

interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

const STEPS: Step[] = [
  { label: 'Address', description: 'Where to deliver' },
  { label: 'Payment', description: 'How you pay' },
  { label: 'Review', description: 'Confirm & place' },
];

// Inline "add new address" form — mirrors the Addresses.tsx add UX so the two
// surfaces stay consistent (label + recipient + lines + makeDefault).
interface AddressFormState {
  label: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  makeDefault: boolean;
}

const EMPTY_ADDRESS: AddressFormState = {
  label: '',
  recipientName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  makeDefault: false,
};

function toAddressRequest(form: AddressFormState): AddressRequest {
  return {
    label: form.label.trim(),
    recipientName: form.recipientName.trim(),
    phone: form.phone.trim() || null,
    addressLine1: form.addressLine1.trim(),
    addressLine2: form.addressLine2.trim() || null,
    city: form.city.trim(),
    state: form.state.trim() || null,
    postalCode: form.postalCode.trim(),
    country: form.country.trim(),
    makeDefault: form.makeDefault,
  };
}

// AddressResponse → the ShippingDetails/ShippingAddressRequest shape placeOrder
// expects. Note `recipientName` maps to `name`; nullable fields pass through.
function toShipping(a: AddressResponse): ShippingDetails {
  return {
    name: a.recipientName,
    phone: a.phone,
    addressLine1: a.addressLine1,
    addressLine2: a.addressLine2,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
  };
}

function formatAddress(a: AddressResponse): string {
  return [a.addressLine1, a.addressLine2, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ');
}

export default function Checkout() {
  useDocumentTitle('Checkout');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refresh } = useCart();
  const toast = useToast();

  const storeQuery = useQuery({ queryKey: ['public-store'], queryFn: getPublicStore });
  const cartQuery = useQuery({ queryKey: ['cart'], queryFn: getCart });
  const addressesQuery = useQuery({ queryKey: ['addresses'], queryFn: listAddresses });

  const savedAddresses = useMemo(() => addressesQuery.data ?? [], [addressesQuery.data]);
  const store = storeQuery.data;
  const cart = cartQuery.data;

  // ── Coupon carry-through (WP-3.4) ─────────────────────────────────────
  // A coupon applied on the Cart page is persisted; re-validate it against the
  // CURRENT server cart on entering checkout (the cart may have changed since).
  // If it no longer applies we drop it with a notice — placement rejects invalid
  // coupons outright, so we never want to send a stale one.
  const [couponCode, setCouponCode] = useState<string | null>(() => getStoredCoupon());
  const [couponDropped, setCouponDropped] = useState<string | null>(null);

  const couponQuery = useQuery({
    queryKey: ['coupon-preview', couponCode, cart?.totalAmount],
    queryFn: () => validateCoupon(couponCode!, cart?.totalAmount),
    enabled: !!couponCode && !!cart,
  });
  const appliedCoupon = couponQuery.data?.valid ? couponQuery.data : null;

  // Drop a now-invalid coupon (expired/exhausted/min-not-met after a cart change).
  useEffect(() => {
    const data = couponQuery.data;
    if (couponCode && data && !data.valid) {
      setCouponDropped(data.message);
      setCouponCode(null);
      clearStoredCoupon();
    }
  }, [couponQuery.data, couponCode]);

  // ── Step + form state (lives in the parent so back/forward never loses it) ──
  const [step, setStep] = useState(0);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [addForm, setAddForm] = useState<AddressFormState>({ ...EMPTY_ADDRESS });
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [placeErrors, setPlaceErrors] = useState<string[]>([]);
  // Failure-recovery banner after a cancelled/failed online payment.
  const [paymentIssue, setPaymentIssue] = useState<string | null>(null);

  const selectedAddress = savedAddresses.find((a) => a.id === selectedAddressId) ?? null;

  // Payment methods available from store config (gated by the store flags).
  const codEnabled = !!store?.codEnabled;
  const onlineEnabled = !!store?.onlinePaymentEnabled;
  const methods = useMemo(() => {
    const opts: { value: PaymentMethod; label: string; desc: string; icon: typeof Wallet }[] = [];
    if (codEnabled)
      opts.push({ value: 'CASH', label: 'Cash on Delivery', desc: 'Pay when your order arrives', icon: Wallet });
    if (onlineEnabled)
      opts.push({ value: 'UPI', label: 'UPI / Online payment', desc: 'Pay securely now via UPI, cards & more', icon: CreditCard });
    // Neither flag on → fall back to COD so a store is never un-checkoutable.
    if (opts.length === 0)
      opts.push({ value: 'CASH', label: 'Cash on Delivery', desc: 'Pay when your order arrives', icon: Wallet });
    return opts;
  }, [codEnabled, onlineEnabled]);

  // Preselect the default (or first) saved address once addresses load.
  useEffect(() => {
    if (selectedAddressId || savedAddresses.length === 0) return;
    const def = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    setSelectedAddressId(def.id);
  }, [savedAddresses, selectedAddressId]);

  // Keep the payment method valid for the available options (preselect the first).
  useEffect(() => {
    if (!methods.some((m) => m.value === paymentMethod)) setPaymentMethod(methods[0].value);
  }, [methods, paymentMethod]);

  // Redirect to /cart if the cart is empty.
  useEffect(() => {
    if (cartQuery.isSuccess && (!cart || cart.items.length === 0)) {
      navigate('/cart', { replace: true });
    }
  }, [cartQuery.isSuccess, cart, navigate]);

  // Move keyboard focus to the active step heading when the step changes.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  const addMutation = useMutation({
    mutationFn: (body: AddressRequest) => addAddress(body),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setSelectedAddressId(created.id);
      setAddingAddress(false);
      setAddForm({ ...EMPTY_ADDRESS });
      setAddErrors({});
      setAddressError(null);
      toast.success('Address added');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.hasFieldErrors()) setAddErrors(e.fieldErrorMap());
      else toast.error('Could not save address', e instanceof Error ? e.message : 'Please try again.');
    },
  });

  function setAdd<K extends keyof AddressFormState>(key: K, value: AddressFormState[K]) {
    setAddForm((f) => ({ ...f, [key]: value }));
  }

  function validateAddForm(): boolean {
    const next: Record<string, string> = {};
    if (!addForm.label.trim()) next.label = 'Label is required';
    if (!addForm.recipientName.trim()) next.recipientName = 'Name is required';
    if (!addForm.addressLine1.trim()) next.addressLine1 = 'Address is required';
    if (!addForm.city.trim()) next.city = 'City is required';
    if (!addForm.postalCode.trim()) next.postalCode = 'Postal code is required';
    if (!addForm.country.trim()) next.country = 'Country is required';
    setAddErrors(next);
    return Object.keys(next).length === 0;
  }

  function saveNewAddress() {
    if (!validateAddForm()) return;
    addMutation.mutate(toAddressRequest(addForm));
  }

  // The add form is shown on demand, or forced open when there is nothing to pick.
  const showAddForm = addingAddress || savedAddresses.length === 0;

  function goToPayment() {
    if (!selectedAddress) {
      setAddressError(
        showAddForm ? 'Add and save a delivery address to continue.' : 'Please select a delivery address.',
      );
      return;
    }
    setAddressError(null);
    setStep(1);
  }

  async function handlePlaceOrder() {
    if (!selectedAddress) {
      setStep(0);
      setAddressError('Please select a delivery address.');
      return;
    }
    const shippingAddress = toShipping(selectedAddress);
    setPlaceErrors([]);
    setPaymentIssue(null);
    setSubmitting(true);
    // Only send a coupon the re-validation confirmed is still valid; placement
    // recomputes the discount authoritatively and rejects an invalid code.
    const body: PlaceOrderRequest = { shippingAddress, notes: notes.trim() || null, paymentMethod };
    if (appliedCoupon) body.couponCode = appliedCoupon.code;
    try {
      const order = await placeOrder(body);

      if (!order.paymentAction) {
        // COD — order complete. The coupon (if any) is now redeemed on the order.
        clearStoredCoupon();
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
        setPaymentIssue('We could not load the payment gateway. Try again, or go back and choose Cash on Delivery.');
        toast.error('Payment unavailable', 'Could not load the payment gateway. Please try again.');
        return;
      }
      if (!window.Razorpay) {
        setSubmitting(false);
        setPaymentIssue('We could not load the payment gateway. Try again, or go back and choose Cash on Delivery.');
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
            clearStoredCoupon();
            toast.success('Payment successful!', 'Thank you — your order is confirmed.');
            await refresh();
            navigate(`/orders/${order.id}`);
          } catch (err) {
            setSubmitting(false);
            setPaymentIssue('We could not verify your payment. If you were charged, contact support — otherwise place the order again.');
            toast.error('Payment verification failed', err instanceof Error ? err.message : 'Please contact support if you were charged.');
          }
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
            setPaymentIssue('Payment was not completed. You can try again, or go back and choose Cash on Delivery.');
            toast.info('Payment not completed', 'Your order is saved as pending — you can pay later.');
          },
        },
      });
      rzp.open();
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.hasFieldErrors()) {
        // Address fields were rejected server-side — surface and send the user back to fix them.
        setPlaceErrors(Object.values(err.fieldErrorMap()));
        toast.error('Please check your address', 'Some delivery-address fields need attention.');
      } else {
        toast.error('Could not place order', err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    }
  }

  if (storeQuery.isLoading || cartQuery.isLoading || addressesQuery.isLoading) return <PageLoader />;
  if (!cart || cart.items.length === 0) return <PageLoader />;

  const currency = cart.currency;

  return (
    <div className="space-y-6">
      <PageHeader title="Checkout" subtitle="Complete your order in three quick steps." />

      <Stepper steps={STEPS} current={step} className="max-w-2xl" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Step content ─────────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {step === 0 && (
            <Card className="space-y-4 p-5">
              <h2 ref={stepHeadingRef} tabIndex={-1} className="text-h4 text-slate-100 outline-none">
                Delivery address
              </h2>

              {savedAddresses.length > 0 && (
                <div className="space-y-2" role="radiogroup" aria-label="Saved addresses">
                  {savedAddresses.map((a) => {
                    const active = selectedAddressId === a.id;
                    return (
                      <label
                        key={a.id}
                        className={
                          'flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition ' +
                          (active ? 'border-gold-400/50 bg-gold-400/5' : 'border-ink-700 hover:border-ink-500')
                        }
                      >
                        <input
                          type="radio"
                          name="saved-address"
                          value={a.id}
                          checked={active}
                          onChange={() => {
                            setSelectedAddressId(a.id);
                            setAddressError(null);
                          }}
                          className="mt-1 h-4 w-4 shrink-0 accent-gold-400"
                        />
                        <span className="min-w-0 text-sm">
                          <span className="flex items-center gap-2">
                            <span className="font-medium text-slate-100">{a.label}</span>
                            {a.isDefault && <span className="text-xs text-gold-300">Default</span>}
                          </span>
                          <span className="block text-slate-400">{a.recipientName}</span>
                          {a.phone && <span className="block text-slate-500">{a.phone}</span>}
                          <span className="block text-slate-500">{formatAddress(a)}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {!showAddForm && (
                <Button variant="secondary" size="sm" onClick={() => setAddingAddress(true)}>
                  <Plus className="h-4 w-4" /> Add a new address
                </Button>
              )}

              {showAddForm && (
                <div className="space-y-4 rounded-xl border border-ink-700 p-4">
                  {savedAddresses.length > 0 && (
                    <h3 className="text-sm font-semibold text-slate-200">New address</h3>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Label" required error={addErrors.label} className="sm:col-span-2">
                      <Input value={addForm.label} onChange={(e) => setAdd('label', e.target.value)} invalid={!!addErrors.label} placeholder="Home, Office…" />
                    </Field>
                    <Field label="Full name" required error={addErrors.recipientName}>
                      <Input value={addForm.recipientName} onChange={(e) => setAdd('recipientName', e.target.value)} invalid={!!addErrors.recipientName} autoComplete="name" />
                    </Field>
                    <Field label="Phone" error={addErrors.phone}>
                      <Input value={addForm.phone} onChange={(e) => setAdd('phone', e.target.value)} autoComplete="tel" />
                    </Field>
                    <Field label="Address line 1" required error={addErrors.addressLine1} className="sm:col-span-2">
                      <Input value={addForm.addressLine1} onChange={(e) => setAdd('addressLine1', e.target.value)} invalid={!!addErrors.addressLine1} autoComplete="address-line1" />
                    </Field>
                    <Field label="Address line 2" error={addErrors.addressLine2} className="sm:col-span-2">
                      <Input value={addForm.addressLine2} onChange={(e) => setAdd('addressLine2', e.target.value)} autoComplete="address-line2" />
                    </Field>
                    <Field label="City" required error={addErrors.city}>
                      <Input value={addForm.city} onChange={(e) => setAdd('city', e.target.value)} invalid={!!addErrors.city} autoComplete="address-level2" />
                    </Field>
                    <Field label="State / Region" error={addErrors.state}>
                      <Input value={addForm.state} onChange={(e) => setAdd('state', e.target.value)} autoComplete="address-level1" />
                    </Field>
                    <Field label="Postal code" required error={addErrors.postalCode}>
                      <Input value={addForm.postalCode} onChange={(e) => setAdd('postalCode', e.target.value)} invalid={!!addErrors.postalCode} autoComplete="postal-code" />
                    </Field>
                    <Field label="Country" required error={addErrors.country}>
                      <Input value={addForm.country} onChange={(e) => setAdd('country', e.target.value)} invalid={!!addErrors.country} autoComplete="country-name" />
                    </Field>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={addForm.makeDefault}
                      onChange={(e) => setAdd('makeDefault', e.target.checked)}
                      className="h-4 w-4 accent-gold-400"
                    />
                    Set as default address
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveNewAddress} loading={addMutation.isPending}>
                      Save address
                    </Button>
                    {savedAddresses.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAddingAddress(false);
                          setAddErrors({});
                          setAddForm({ ...EMPTY_ADDRESS });
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {addressError && (
                <p className="text-sm text-danger-300" role="alert">
                  {addressError}
                </p>
              )}
            </Card>
          )}

          {step === 1 && (
            <Card className="space-y-3 p-5">
              <h2 ref={stepHeadingRef} tabIndex={-1} className="text-h4 text-slate-100 outline-none">
                Payment method
              </h2>
              <div className="space-y-2" role="radiogroup" aria-label="Payment method">
                {methods.map((m) => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.value;
                  return (
                    <label
                      key={m.value}
                      className={
                        'flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ' +
                        (active ? 'border-gold-400/50 bg-gold-400/5' : 'border-ink-700 hover:border-ink-500')
                      }
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="payment"
                          value={m.value}
                          checked={active}
                          onChange={() => setPaymentMethod(m.value)}
                          className="h-4 w-4 accent-gold-400"
                        />
                        <Icon className="h-5 w-5 text-slate-400" />
                        <span className="text-sm font-medium text-slate-100">{m.label}</span>
                      </span>
                      <span className="text-xs text-slate-500">{m.desc}</span>
                    </label>
                  );
                })}
              </div>
              {!onlineEnabled && (
                <p className="text-xs text-slate-500">
                  Online payment is currently unavailable for this store — orders are placed as Cash on Delivery.
                </p>
              )}
            </Card>
          )}

          {step === 2 && (
            <Card className="space-y-5 p-5">
              <h2 ref={stepHeadingRef} tabIndex={-1} className="text-h4 text-slate-100 outline-none">
                Review &amp; place order
              </h2>

              <section className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <MapPin className="h-4 w-4 text-slate-400" /> Delivery to
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                    Change
                  </Button>
                </div>
                {selectedAddress ? (
                  <div className="text-sm text-slate-400">
                    <p className="font-medium text-slate-200">{selectedAddress.recipientName}</p>
                    {selectedAddress.phone && <p>{selectedAddress.phone}</p>}
                    <p>{formatAddress(selectedAddress)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-danger-300">No address selected.</p>
                )}
              </section>

              <section className="space-y-1 border-t border-ink-800 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">Payment</h3>
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                    Change
                  </Button>
                </div>
                <p className="text-sm text-slate-400">
                  {methods.find((m) => m.value === paymentMethod)?.label ?? paymentMethod}
                </p>
              </section>

              <section className="border-t border-ink-800 pt-4">
                <Field label="Order notes">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={1000}
                    placeholder="Delivery instructions, landmarks, etc. (optional)"
                  />
                </Field>
              </section>

              {paymentIssue && (
                <div className="flex items-start gap-2 rounded-xl border border-warning-500/30 bg-warning-500/15 p-3 text-sm text-warning-300" role="alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{paymentIssue}</p>
                </div>
              )}

              {placeErrors.length > 0 && (
                <div className="rounded-xl border border-danger-500/30 bg-danger-500/15 p-3 text-sm text-danger-300" role="alert">
                  <ul className="list-inside list-disc space-y-1">
                    {placeErrors.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {/* ── Step navigation ────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3">
            {step === 0 ? (
              <LinkButton to="/cart" variant="ghost">
                Back to cart
              </LinkButton>
            ) : (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
                Back
              </Button>
            )}

            {step === 0 && <Button onClick={goToPayment}>Continue to payment</Button>}
            {step === 1 && <Button onClick={() => setStep(2)}>Continue to review</Button>}
            {step === 2 && (
              <Button onClick={handlePlaceOrder} loading={submitting} size="lg">
                Place order
              </Button>
            )}
          </div>
        </div>

        {/* ── Sticky order summary ─────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
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

            {couponDropped && (
              <div className="flex items-start gap-2 rounded-xl border border-warning-500/30 bg-warning-500/15 p-3 text-xs text-warning-300" role="status">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>Your coupon was removed — {couponDropped}</p>
              </div>
            )}

            <dl className="space-y-2 border-t border-ink-800 pt-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Subtotal</dt>
                <dd className="text-slate-200">{money(cart.totalAmount, currency)}</dd>
              </div>
              {appliedCoupon && (
                <div className="flex items-center justify-between text-success-300">
                  <dt className="flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" /> Discount ({appliedCoupon.code})
                  </dt>
                  <dd className="font-medium">−{money(appliedCoupon.discountAmount, currency)}</dd>
                </div>
              )}
            </dl>

            <div className="flex items-center justify-between border-t border-ink-800 pt-4 text-base font-bold">
              <span className="text-slate-300">Total</span>
              <span className="text-gold-300">{money(appliedCoupon?.total ?? cart.totalAmount, currency)}</span>
            </div>
            <p className="text-xs text-slate-500">
              {appliedCoupon
                ? 'Final discount is confirmed when you place the order.'
                : 'Shipping & taxes calculated at checkout.'}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
