import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CreditCard, MapPin, Plus, QrCode, Store as StoreIcon, Tag, Truck, Wallet } from 'lucide-react';
import { getPublicStore } from '@/api/store';
import { addToCart, getCart } from '@/api/cart';
import { cancelOrder, placeOrder, verifyRazorpayPayment } from '@/api/orders';
import { validateCoupon } from '@/api/coupons';
import { addAddress, listAddresses } from '@/api/addresses';
import { loadRazorpay } from '@/lib/razorpay';
import { clearStoredCoupon, getStoredCoupon } from '@/lib/couponStorage';
import { ApiError } from '@/lib/http';
import { money } from '@/lib/format';
import { estimateCartTotals } from '@/lib/totals';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type {
  AddressRequest,
  AddressResponse,
  DeliveryMethod,
  OrderResponse,
  PaymentMethod,
  PlaceOrderRequest,
  ShippingDetails,
  UpiApp,
} from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { BRAND_NAME } from '@/lib/brand';
import { Divided, InfoRow, OrderLine, SummarySection } from '@/components/summary';
import {
  Button,
  Field,
  Input,
  LinkButton,
  Modal,
  PageLoader,
  Spinner,
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
  { label: 'Review', description: 'Pay & confirm' },
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

function firstNameOf(order: OrderResponse): string | undefined {
  return order.shippingAddress.name?.trim().split(/\s+/)[0];
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
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('DELIVERY');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [addForm, setAddForm] = useState<AddressFormState>({ ...EMPTY_ADDRESS });
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  // Pickup contact — no street address needed, just who to hand the order to.
  const [pickupName, setPickupName] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [placeErrors, setPlaceErrors] = useState<string[]>([]);
  // Failure-recovery banner after a cancelled/failed online payment.
  const [paymentIssue, setPaymentIssue] = useState<string | null>(null);

  // Manual UPI: customer scans QR to pay. When payment is marked done, the order flow
  // completes and navigates directly to the order details page.
  const [manualUpiOrder, setManualUpiOrder] = useState<OrderResponse | null>(null);
  const [manualUpiConfirming, setManualUpiConfirming] = useState(false);
  const [restoringCart, setRestoringCart] = useState(false);

  function finishManualUpiOrder() {
    if (!manualUpiOrder) return;
    const orderToOpen = manualUpiOrder;
    setManualUpiConfirming(true);
    try {
      localStorage.setItem(`rc-manual-upi-done-${orderToOpen.id}`, '1');
    } catch {
      // best-effort
    }
    // Brief confirming pause to give feedback, then take user directly to order details page
    setTimeout(async () => {
      setManualUpiConfirming(false);
      setManualUpiOrder(null);
      clearStoredCoupon();
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Order placed!', 'Thank you — your order has been received.');
      navigate(`/orders/${orderToOpen.id}`);
    }, 1000);
  }

  async function closeManualUpiModal() {
    if (!manualUpiOrder) return;
    const orderToClose = manualUpiOrder;

    // Closed via the X before confirming payment:
    // 1. Cancel the order on server so it is NOT placed
    // 2. Restore items back to the user's cart in the database
    // 3. User remains at the review page only
    setManualUpiConfirming(false);
    setManualUpiOrder(null);
    setSubmitting(false);
    setRestoringCart(true);

    try {
      await cancelOrder(orderToClose.id);
      for (const it of orderToClose.items) {
        try {
          await addToCart(it.productId, it.quantity, it.variantId);
        } catch {
          // ignore individual add failure
        }
      }
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.info('Order not placed', 'Payment was not confirmed. You can review your order and try again.');
    } catch {
      // best-effort
    } finally {
      setRestoringCart(false);
      setStep(1);
    }
  }

  const selectedAddress = savedAddresses.find((a) => a.id === selectedAddressId) ?? null;

  // Pre-placement estimate from the store's published rules; null while they are
  // unknown. The order response is authoritative once placed.
  // Pickup never charges shipping, regardless of the store's configured rate — mirrors the
  // backend's own policyFor(store, deliveryMethod) so the estimate never overstates the total.
  const estimateStore = deliveryMethod === 'PICKUP' && store ? { ...store, shippingFlatAmount: 0, freeShippingThreshold: null } : store;
  const estimate = estimateCartTotals(cart?.totalAmount ?? 0, appliedCoupon?.discountAmount ?? 0, estimateStore);

  // Payment methods available from store config (gated by the store flags).
  const codEnabled = !!store?.codEnabled;
  const onlineEnabled = !!store?.onlinePaymentEnabled;
  const manualUpiEnabled = !!store?.manualUpiEnabled;
  const pickupEnabled = !!store?.pickupEnabled;

  // The shop's own UPI id belongs to some app — @okaxis to Google Pay, @ybl to PhonePe — and that
  // is a fact about ITS bank account, not a requirement on the customer: upi://pay is an open
  // standard and any UPI app pays any handle. So the app choice exists in exactly one case, where
  // it means something: the shop verifies payments by token, and needs to know which of its
  // accounts to look in for one. Everywhere else this is empty and the copy stays generic.
  const upiTokenVerification = manualUpiEnabled && !!store?.manualUpiTokenVerificationEnabled;
  const upiApps = useMemo(
    () => (upiTokenVerification ? store?.manualUpiApps ?? [] : []),
    [upiTokenVerification, store?.manualUpiApps],
  );
  const [upiApp, setUpiApp] = useState<UpiApp | null>(null);
  // Only ever holds an app the store still offers, so a merchant disabling one between page load
  // and checkout cannot leave a stale selection to be rejected at placement.
  useEffect(() => {
    setUpiApp((current) => (current && upiApps.some((a) => a.app === current) ? current : null));
  }, [upiApps]);

  // Priority order — also the default-selection order below: a real payment gateway beats a
  // manually-verified UPI scan, which beats paying nothing up front.
  const methods = useMemo(() => {
    const opts: { value: PaymentMethod; label: string; desc: string; icon: typeof Wallet }[] = [];
    if (onlineEnabled)
      opts.push({ value: 'UPI', label: 'UPI / Online payment', desc: 'Pay securely now via UPI, cards & more', icon: CreditCard });
    if (manualUpiEnabled)
      opts.push({
        value: 'MANUAL_UPI',
        label: 'UPI (scan to pay)',
        desc: upiTokenVerification
          ? 'Scan a QR, pay us directly, then quote your token at pickup/delivery'
          : 'Scan a QR and pay us directly from any UPI app',
        icon: QrCode,
      });
    if (codEnabled)
      opts.push({ value: 'CASH', label: 'Cash on Delivery', desc: 'Pay when your order arrives', icon: Wallet });
    // No flag on → fall back to COD so a store is never un-checkoutable.
    if (opts.length === 0)
      opts.push({ value: 'CASH', label: 'Cash on Delivery', desc: 'Pay when your order arrives', icon: Wallet });
    return opts;
  }, [codEnabled, onlineEnabled, manualUpiEnabled, upiTokenVerification]);

  // Preselect the default (or first) saved address once addresses load.
  useEffect(() => {
    if (selectedAddressId || savedAddresses.length === 0) return;
    const def = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    setSelectedAddressId(def.id);
  }, [savedAddresses, selectedAddressId]);

  // Default to the highest-priority available method (see `methods` above) until the shopper
  // actually picks one themselves — after that their choice sticks even as store data settles.
  const paymentMethodTouched = useRef(false);
  useEffect(() => {
    if (paymentMethodTouched.current) return;
    if (methods.length && methods[0].value !== paymentMethod) setPaymentMethod(methods[0].value);
  }, [methods, paymentMethod]);

  function choosePaymentMethod(value: PaymentMethod) {
    paymentMethodTouched.current = true;
    setPaymentMethod(value);
  }

  // Redirect to /cart if the cart is empty.
  useEffect(() => {
    if (cartQuery.isSuccess && (!cart || cart.items.length === 0) && !manualUpiOrder && !restoringCart) {
      navigate('/cart', { replace: true });
    }
  }, [cartQuery.isSuccess, cart, navigate, manualUpiOrder, restoringCart]);

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

  function goToReview() {
    if (deliveryMethod === 'PICKUP') {
      if (!pickupName.trim()) {
        setAddressError('Please tell us who is picking up the order.');
        return;
      }
      setAddressError(null);
      setStep(1);
      return;
    }
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
    let shippingAddress: ShippingDetails;
    if (deliveryMethod === 'PICKUP') {
      if (!pickupName.trim()) {
        setStep(0);
        setAddressError('Please tell us who is picking up the order.');
        return;
      }
      shippingAddress = {
        name: pickupName.trim(),
        phone: pickupPhone.trim() || null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
      };
    } else {
      if (!selectedAddress) {
        setStep(0);
        setAddressError('Please select a delivery address.');
        return;
      }
      shippingAddress = toShipping(selectedAddress);
    }
    setPlaceErrors([]);
    setPaymentIssue(null);
    setSubmitting(true);
    // Only send a coupon the re-validation confirmed is still valid; placement
    // recomputes the discount authoritatively and rejects an invalid code.
    const body: PlaceOrderRequest = { shippingAddress, notes: notes.trim() || null, paymentMethod, deliveryMethod };
    if (appliedCoupon) body.couponCode = appliedCoupon.code;
    // Caught here as well as server-side so the customer is told which field to fix rather than
    // being handed a UPI_APP_REQUIRED after their stock has been reserved and released again.
    if (paymentMethod === 'MANUAL_UPI' && upiTokenVerification) {
      if (!upiApp) {
        setSubmitting(false);
        setPlaceErrors(['Choose the UPI app you will pay from.']);
        return;
      }
      body.upiApp = upiApp;
    }
    try {
      const order = await placeOrder(body);

      if (!order.paymentAction) {
        if (order.manualUpiPayment) {
          // Order exists server-side (the token and QR are tied to it), but the customer doesn't
          // see the order summary until they've scanned, paid and confirmed — see
          // finishManualUpiOrder / the pop-up below.
          setManualUpiOrder(order);
          setSubmitting(false);
          return;
        }
        clearStoredCoupon();
        await refresh();
        await queryClient.invalidateQueries({ queryKey: ['cart'] });
        toast.success('Order placed!', 'Thank you — your order has been received.');
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
        name: store?.name ?? BRAND_NAME,
        description: `Order ${order.id}`,
        prefill: { name: shippingAddress.name, contact: shippingAddress.phone ?? '' },
        // Razorpay's modal is their DOM, so this is a literal rather than a
        // token — it is the brand gold from the identity sheet.
        theme: { color: '#D4AF37' },
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
  const bagCount = cart.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div>
      <header className="border-b border-ink-700 pb-6">
        <h1 className="font-display text-h1 text-slate-100">Checkout</h1>
      </header>

      <Stepper steps={STEPS} current={step} className="mt-8 max-w-2xl" />

      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_22rem]">
        {/* ── Step content ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          {step === 0 && (
            <section className="space-y-5 rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-card">
              <h2 ref={stepHeadingRef} tabIndex={-1} className="text-h4 text-slate-100 outline-none">
                {deliveryMethod === 'PICKUP' ? 'Pickup details' : 'Delivery address'}
              </h2>

              {pickupEnabled && (
                <div className="space-y-2" role="radiogroup" aria-label="Delivery method">
                  {(
                    [
                      { value: 'DELIVERY' as const, label: 'Ship to me', desc: 'Delivered to your address', icon: Truck },
                      { value: 'PICKUP' as const, label: 'Collect in person', desc: 'No delivery charge', icon: StoreIcon },
                    ]
                  ).map((m) => {
                    const active = deliveryMethod === m.value;
                    const Icon = m.icon;
                    return (
                      <label
                        key={m.value}
                        className={
                          'flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ' +
                          (active ? 'border-primary bg-ink-850' : 'border-ink-600 hover:border-slate-100')
                        }
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="delivery-method"
                            checked={active}
                            onChange={() => {
                              setDeliveryMethod(m.value);
                              setAddressError(null);
                            }}
                            className="h-4 w-4 accent-primary"
                          />
                          <Icon className="h-5 w-5 text-slate-400" />
                          <span className="text-sm font-medium text-slate-100">{m.label}</span>
                        </span>
                        <span className="text-xs text-slate-500">{m.desc}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {deliveryMethod === 'PICKUP' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Full name" required>
                    <Input value={pickupName} onChange={(e) => setPickupName(e.target.value)} autoComplete="name" />
                  </Field>
                  <Field label="Phone" hint="So we can reach you when it's ready.">
                    <Input value={pickupPhone} onChange={(e) => setPickupPhone(e.target.value)} autoComplete="tel" />
                  </Field>
                </div>
              ) : (
                <>
              {savedAddresses.length > 0 && (
                <div className="space-y-2" role="radiogroup" aria-label="Saved addresses">
                  {savedAddresses.map((a) => {
                    const active = selectedAddressId === a.id;
                    return (
                      <label
                        key={a.id}
                        className={
                          'flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition ' +
                          (active ? 'border-primary bg-ink-850' : 'border-ink-600 hover:border-slate-100')
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
                          className="mt-1 h-4 w-4 shrink-0 accent-primary"
                        />
                        <span className="min-w-0 text-sm">
                          <span className="flex items-center gap-2">
                            <span className="font-medium text-slate-100">{a.label}</span>
                            {a.isDefault && <span className="text-overline uppercase text-slate-500">Default</span>}
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
                      className="h-4 w-4 accent-primary"
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
                </>
              )}

              {addressError && (
                <p className="text-sm text-danger-300" role="alert">
                  {addressError}
                </p>
              )}
            </section>
          )}

          {step === 1 && (
            <section className="space-y-6 rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-card">
              <h2 ref={stepHeadingRef} tabIndex={-1} className="text-h4 text-slate-100 outline-none">
                Review &amp; place order
              </h2>

              <section className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    {deliveryMethod === 'PICKUP' ? (
                      <StoreIcon className="h-4 w-4 text-slate-400" />
                    ) : (
                      <MapPin className="h-4 w-4 text-slate-400" />
                    )}{' '}
                    {deliveryMethod === 'PICKUP' ? 'Collect in person' : 'Delivery to'}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                    Change
                  </Button>
                </div>
                {deliveryMethod === 'PICKUP' ? (
                  pickupName.trim() ? (
                    <div className="text-sm text-slate-400">
                      <p className="font-medium text-slate-200">{pickupName}</p>
                      {pickupPhone && <p>{pickupPhone}</p>}
                      <p>Collected in person — no delivery.</p>
                    </div>
                  ) : (
                    <p className="text-sm text-danger-300">No pickup contact given.</p>
                  )
                ) : selectedAddress ? (
                  <div className="text-sm text-slate-400">
                    <p className="font-medium text-slate-200">{selectedAddress.recipientName}</p>
                    {selectedAddress.phone && <p>{selectedAddress.phone}</p>}
                    <p>{formatAddress(selectedAddress)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-danger-300">No address selected.</p>
                )}
              </section>

              <section className="space-y-3 border-t border-ink-600 pt-5">
                <h3 className="text-sm font-semibold text-slate-200">Payment method</h3>
                <div className="space-y-2" role="radiogroup" aria-label="Payment method">
                  {methods.map((m) => {
                    const Icon = m.icon;
                    const active = paymentMethod === m.value;
                    return (
                      <label
                        key={m.value}
                        className={
                          'flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ' +
                          (active ? 'border-primary bg-ink-850' : 'border-ink-600 hover:border-slate-100')
                        }
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="payment"
                            value={m.value}
                            checked={active}
                            onChange={() => choosePaymentMethod(m.value)}
                            className="h-4 w-4 accent-primary"
                          />
                          <Icon className="h-5 w-5 text-slate-400" />
                          <span className="text-sm font-medium text-slate-100">{m.label}</span>
                        </span>
                        <span className="text-xs text-slate-500">{m.desc}</span>
                      </label>
                    );
                  })}
                </div>
                {methods.length === 1 && (
                  <p className="text-xs text-slate-500">
                    {methods[0].label} is the only payment method available for this store.
                  </p>
                )}

                {/* Rendered ONLY when this shop verifies payments by token — never as a
                    consequence of which app its own UPI id happens to be registered with. The list
                    comes from the server already filtered to the apps the merchant enabled; an
                    empty one means there is no choice to make and this block must not appear. */}
                {paymentMethod === 'MANUAL_UPI' && upiTokenVerification && upiApps.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-ink-600 p-4">
                    <p className="text-sm font-medium text-slate-100">Which UPI app will you pay from?</p>
                    <p className="text-xs text-slate-500">
                      We check that app's account for your payment before confirming your order.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {upiApps.map((option) => {
                        const active = upiApp === option.app;
                        return (
                          <button
                            key={option.app}
                            type="button"
                            onClick={() => setUpiApp(option.app)}
                            aria-pressed={active}
                            className={
                              'rounded-lg border px-3 py-2 text-sm transition ' +
                              (active
                                ? 'border-primary bg-ink-850 text-slate-100'
                                : 'border-ink-600 text-slate-300 hover:border-slate-100')
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              <section className="border-t border-ink-600 pt-5">
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
                <div className="flex items-start gap-2 border border-warning-500/30 bg-warning-500/15 p-3 text-sm text-warning-300" role="alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{paymentIssue}</p>
                </div>
              )}

              {placeErrors.length > 0 && (
                <div className="border border-danger-500/30 bg-danger-500/15 p-3 text-sm text-danger-300" role="alert">
                  <ul className="list-inside list-disc space-y-1">
                    {placeErrors.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
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

            {step === 0 && <Button onClick={goToReview}>Continue to review</Button>}
            {step === 1 && (
              <Button onClick={handlePlaceOrder} loading={submitting} size="xl">
                Place order
              </Button>
            )}
          </div>
        </div>

        {/* ── Sticky order summary ─────────────────────────────────────── */}
        {/* The same blocks the order receipt uses. What the shopper approves here and what they are
            shown afterwards should be recognisably one object — laid out differently, people
            re-read the second looking for what changed. */}
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <SummarySection title={`Items · ${bagCount}`} bodyClassName="px-5 py-1">
            <Divided>
              {cart.items.map((i) => (
                <OrderLine
                  key={i.cartItemId}
                  name={i.productName}
                  meta={i.variantOptionsLabel ?? null}
                  imageUrl={i.productImageUrl}
                  quantity={i.quantity}
                  unitPrice={money(i.unitPrice, currency)}
                  subtotal={money(i.subtotal, currency)}
                />
              ))}
            </Divided>
          </SummarySection>

          {couponDropped && (
            <div className="flex items-start gap-2 rounded-2xl border border-warning-500/30 bg-warning-500/15 p-3 text-xs text-warning-300" role="status">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>Your coupon was removed — {couponDropped}</p>
            </div>
          )}

          <SummarySection title="Bill summary" bodyClassName="px-5 py-1.5">
            <dl className="divide-y divide-ink-700">
              <InfoRow label="Item total">{money(cart.totalAmount, currency)}</InfoRow>

              {appliedCoupon && (
                <InfoRow
                  label={
                    <span className="flex items-center gap-1 text-success-300">
                      <Tag className="h-3.5 w-3.5" aria-hidden /> Discount ({appliedCoupon.code})
                    </span>
                  }
                >
                  <span className="text-success-300">−{money(appliedCoupon.discountAmount, currency)}</span>
                </InfoRow>
              )}

              <InfoRow label={deliveryMethod === 'PICKUP' ? 'Pickup' : 'Delivery'}>
                {deliveryMethod === 'PICKUP' ? (
                  <span className="text-success-300">Free</span>
                ) : estimate ? (
                  estimate.shipping === 0 ? (
                    <span className="text-success-300">Free</span>
                  ) : (
                    money(estimate.shipping, currency)
                  )
                ) : (
                  '—'
                )}
              </InfoRow>

              {estimate?.hasTax && !estimate.taxInclusive && (
                <InfoRow label={`Tax (${estimate.taxRatePercent}%)`}>
                  {money(estimate.tax, currency)}
                </InfoRow>
              )}

              <InfoRow label={estimate ? 'Estimated total' : 'Total'} emphasis>
                {money(estimate?.total ?? appliedCoupon?.total ?? cart.totalAmount, currency)}
              </InfoRow>
            </dl>

            <p className="pb-2.5 text-caption text-slate-500">
              {/* The server recomputes everything at placement — the discount against the live cart,
                  delivery and tax against current settings — so this figure is always advisory. */}
              {estimate?.taxInclusive && estimate.hasTax
                ? `Includes ${money(estimate.tax, currency)} tax. Confirmed when you place the order.`
                : 'Confirmed when you place the order.'}
            </p>
          </SummarySection>
        </aside>
      </div>

      {manualUpiOrder && manualUpiOrder.manualUpiPayment && (
        <Modal
          open
          onClose={closeManualUpiModal}
          title="Pay via UPI"
          size="sm"
          dismissible={false}
        >
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <img
              src={manualUpiOrder.manualUpiPayment.qrDataUri}
              alt="Scan to pay via UPI"
              className="h-56 w-56 rounded-lg border border-ink-700 bg-white p-2"
            />
            <div>
              <p className="text-h3 font-display text-slate-100">
                {money(manualUpiOrder.manualUpiPayment.amount, manualUpiOrder.manualUpiPayment.currency)}
              </p>
              <p className="mt-1 text-body-sm text-slate-400">to {manualUpiOrder.manualUpiPayment.vpa}</p>
            </div>
            {/* The token is shown only where the shop actually runs a counter step that uses it.
                Under the ordinary flow it exists as the order's reference, and presenting it as
                something to keep would be inventing a ritual this shop does not run. */}
            {manualUpiOrder.manualUpiPayment.tokenVerificationEnabled && (
              <div className="w-full rounded-lg border border-ink-600 bg-ink-850 px-4 py-3">
                <p className="text-caption uppercase tracking-wide text-slate-500">Your payment token</p>
                <p className="mt-1 font-mono text-h3 tracking-widest text-primary">
                  {manualUpiOrder.manualUpiPayment.token}
                </p>
              </div>
            )}
            {manualUpiConfirming ? (
              <div className="flex items-center gap-2 text-body-sm text-slate-400">
                <Spinner className="h-4 w-4" />
                Confirming your payment…
              </div>
            ) : (
              <Button onClick={finishManualUpiOrder}>Mark payment done</Button>
            )}
            <p className="max-w-sm text-caption text-slate-400">
              {manualUpiConfirming
                ? 'Confirming payment — you will be redirected to your order details shortly.'
                : manualUpiOrder.manualUpiPayment.tokenVerificationEnabled
                  ? `Pay ${manualUpiOrder.manualUpiPayment.appLabel ?? 'from your chosen UPI app'}, then keep your token — quote it when you collect your order. Once you've paid, tap Mark payment done.`
                  : "Scan the QR with any UPI app to pay. Once you've paid, tap Mark payment done."}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
