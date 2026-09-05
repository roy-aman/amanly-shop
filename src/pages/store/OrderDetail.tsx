import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Clock, MapPin, PackageX, QrCode, Store as StoreIcon } from 'lucide-react';
import { getOrder, cancelOrder, enableManualUpiForOrder } from '@/api/orders';
import { ApiError } from '@/lib/http';
import { formatDateTime, money, orderRef, titleCase } from '@/lib/format';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { OrderTotals } from '@/components/OrderTotals';
import { Divided, InfoRow, OrderLine, SummarySection } from '@/components/summary';
import { useToast } from '@/context/ToastContext';
import { useStore } from '@/context/StoreContext';
import { Button, EmptyState, LinkButton, Modal, Spinner } from '@/components/ui';
import { DetailSkeleton } from '@/components/RouteSkeletons';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { UpiApp } from '@/lib/types';

/**
 * A placed order, laid out as the receipt it is: a narrow stack of labelled blocks — what was
 * bought, the order's facts, where it goes, what it cost.
 *
 * <p>It used to be a four-column table inside a two-column grid, which is an admin screen. The
 * figures were the same; finding any one of them meant reading across. Capping the column keeps the
 * eye travelling down a single edge, which is why receipts have always been narrow.
 */
export default function OrderDetail() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [showMarkDone, setShowMarkDone] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [tokenRevealed, setTokenRevealed] = useState(false);
  const [enablingUpi, setEnablingUpi] = useState(false);
  const [upiApp, setUpiApp] = useState<UpiApp | null>(null);
  const { store } = useStore();

  // The app choice exists only where the shop verifies payments by token and needs to know which
  // of its accounts to look in. The shop's UPI id belonging to Google Pay or PhonePe is a fact
  // about its own bank account and never a requirement on the customer — any UPI app pays any
  // handle — so outside that flow no app is named and nothing is asked.
  const upiApps = (store?.manualUpiTokenVerificationEnabled && store?.manualUpiApps) || [];

  async function handlePayViaUpi() {
    if (order?.manualUpiPayment) {
      setQrOpen(true);
      return;
    }
    if (!order) return;
    if (needsAppChoice && !upiApp) {
      toast.error('Choose a UPI app', 'Pick the app you will pay from so we can confirm your payment.');
      return;
    }
    setEnablingUpi(true);
    try {
      const updated = await enableManualUpiForOrder(order.id, needsAppChoice ? upiApp : null);
      queryClient.setQueryData(['order', id], updated);
      setQrOpen(true);
    } catch (e) {
      toast.error('Could not initiate UPI payment', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setEnablingUpi(false);
    }
  }
  // Marking payment done doesn't touch the backend (see handleMarkPaymentDone) — persist it
  // locally so the "Pay via UPI" trigger stays hidden after a reload, not just within the modal.
  const [markedDone, setMarkedDone] = useState(() => {
    try {
      return id ? localStorage.getItem(`rc-manual-upi-done-${id}`) === '1' : false;
    } catch {
      return false;
    }
  });

  // The QR shows immediately; "Mark payment done" takes 5s to appear below it — enough time to
  // actually scan and pay before the button to confirm it shows up.
  useEffect(() => {
    if (!qrOpen) {
      setConfirming(false);
      setTokenRevealed(false);
      setShowMarkDone(false);
      return;
    }
    const timer = setTimeout(() => setShowMarkDone(true), 5000);
    return () => clearTimeout(timer);
  }, [qrOpen]);

  function handleMarkPaymentDone() {
    setConfirming(true);
    setTimeout(() => {
      setConfirming(false);
      setTokenRevealed(true);
      setMarkedDone(true);
      try {
        localStorage.setItem(`rc-manual-upi-done-${id}`, '1');
      } catch {
        // best-effort — worst case the "Pay via UPI" button reappears after a reload
      }
    }, 5000);
  }

  const orderQuery = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const order = orderQuery.data;

  const needsAppChoice = upiApps.length > 0 && !order?.manualUpiPayment;
  // An order carries its own answer once it has a payment; only an untouched COD order is still
  // choosing, and reads the store's current setting instead.
  const tokenVerification = order?.manualUpiPayment
    ? !!order.manualUpiPayment.tokenVerificationEnabled
    : upiApps.length > 0;

  useDocumentTitle(order ? `Order ${orderRef(order)}` : 'Order');

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelOrder(id);
      await queryClient.invalidateQueries({ queryKey: ['order', id] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order cancelled', 'Your order has been cancelled.');
      setConfirmOpen(false);
    } catch (e) {
      toast.error('Could not cancel order', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setCancelling(false);
    }
  }

  if (orderQuery.isLoading) return <DetailSkeleton />;

  if (orderQuery.isError || !order) {
    const err = orderQuery.error;
    const notFound = err instanceof ApiError && err.status === 404;
    return (
      <EmptyState
        icon={<PackageX className="h-10 w-10" />}
        title={notFound ? 'Order not found' : 'Could not load order'}
        message={notFound ? 'This order does not exist or is not yours.' : err instanceof Error ? err.message : 'Please try again shortly.'}
        action={<LinkButton to="/orders">Back to orders</LinkButton>}
      />
    );
  }

  const a = order.shippingAddress;
  const firstName = (a?.name || '').trim().split(/\s+/)[0];
  const canCancel = order.status === 'PENDING' || order.status === 'PROCESSING';
  const itemCount = order.items.reduce((n, it) => n + it.quantity, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Back, the word for the page, and the reference number quietly under it — the header every
          order screen a shopper already uses has trained them to expect. */}
      <header className="flex items-start gap-3">
        <Link
          to="/orders"
          aria-label="Back to orders"
          className="-ml-2 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-ink-850 hover:text-slate-100"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-h2 text-slate-100">Order summary</h1>
          <p className="mt-0.5 text-body-sm tabular-nums text-slate-500">{orderRef(order)}</p>
        </div>
        {canCancel && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="shrink-0 rounded text-body-sm text-slate-500 underline-offset-4 transition hover:text-danger-300 hover:underline"
          >
            Cancel order
          </button>
        )}
      </header>

      <SummarySection
        title={`Items ordered${itemCount > 1 ? ` · ${itemCount}` : ''}`}
        bodyClassName="px-5 py-1"
      >
        <Divided>
          {order.items.map((it) => (
            <OrderLine
              key={it.id}
              name={it.productName}
              meta={it.variantOptions ?? `SKU: ${it.variantSku ?? it.sku}`}
              imageUrl={it.productImageUrl}
              quantity={it.quantity}
              unitPrice={money(it.unitPrice, order.currency)}
              subtotal={money(it.subtotal, order.currency)}
            />
          ))}
        </Divided>
      </SummarySection>

      <SummarySection title="Order info" bodyClassName="px-5 py-1.5">
        <dl className="divide-y divide-ink-700">
          <InfoRow label="Order ID">
            <span className="tabular-nums">{orderRef(order)}</span>
          </InfoRow>
          <InfoRow label="Ordered on">{formatDateTime(order.createdAt)}</InfoRow>
          <InfoRow label="Status">
            <OrderStatusBadge status={order.status} audience="customer" />
          </InfoRow>
          <InfoRow label="Payment">
            <span className="inline-flex items-center gap-2">
              {order.paymentMethod === 'MANUAL_UPI' ? 'Manual UPI' : titleCase(order.paymentMethod)}
              <PaymentStatusBadge status={order.paymentStatus} />
            </span>
          </InfoRow>
          <InfoRow label="Last updated">{formatDateTime(order.updatedAt)}</InfoRow>
        </dl>
      </SummarySection>

      {(order.manualUpiPayment || order.manualUpiPayAvailable) && !markedDone && order.status !== 'CANCELLED' && (
        <SummarySection title="Pay via UPI" bodyClassName="px-5 py-3">
          {needsAppChoice && (
            <div className="mb-3 space-y-2">
              <p className="text-body-sm text-slate-400">
                Which UPI app will you pay from? We check that app&apos;s account for your payment.
              </p>
              <div className="flex flex-wrap gap-2">
                {upiApps.map((option) => (
                  <button
                    key={option.app}
                    type="button"
                    onClick={() => setUpiApp(option.app)}
                    aria-pressed={upiApp === option.app}
                    className={
                      'rounded-lg border px-3 py-2 text-body-sm transition ' +
                      (upiApp === option.app
                        ? 'border-primary bg-ink-850 text-slate-100'
                        : 'border-ink-600 text-slate-300 hover:border-slate-100')
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button onClick={handlePayViaUpi} loading={enablingUpi} fullWidth>
            <QrCode className="h-4 w-4" aria-hidden />
            Pay via UPI
          </Button>
        </SummarySection>
      )}

      {/* Shown only where the shop runs the token step. Under the ordinary flow the token is the
          order's internal reference — presenting it as something to quote invents a ritual this
          shop does not run, and the payment status block already says where the order stands. */}
      {(!order.manualUpiPayment || markedDone) && order.manualUpiToken && tokenVerification && (
        <SummarySection title="Manual UPI payment">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400/10 text-brand-ink">
              <QrCode className="h-5 w-5" aria-hidden />
            </div>
            <div className="text-body-sm text-slate-400">
              <p className="font-medium text-slate-100">
                <span className="font-mono">{firstName ? `${firstName}: ${order.manualUpiToken}` : order.manualUpiToken}</span>
              </p>
              <p>
                {order.paymentStatus === 'PAID'
                  ? 'Payment confirmed.'
                  : 'Awaiting store confirmation — quote this token if asked.'}
              </p>
            </div>
          </div>
        </SummarySection>
      )}

      <SummarySection title={order.deliveryMethod === 'PICKUP' ? 'Pickup' : 'Delivery address'}>
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400/10 text-brand-ink">
            {order.deliveryMethod === 'PICKUP' ? (
              <StoreIcon className="h-5 w-5" aria-hidden />
            ) : (
              <MapPin className="h-5 w-5" aria-hidden />
            )}
          </div>
          <address className="min-w-0 space-y-0.5 text-body-sm not-italic text-slate-400">
            <p className="font-medium text-slate-100">{a.name}</p>
            {a.phone && <p>{a.phone}</p>}
            {order.deliveryMethod === 'PICKUP' ? (
              <p>Collected in person — no delivery.</p>
            ) : (
              <>
                <p>{a.addressLine1}</p>
                {a.addressLine2 && <p>{a.addressLine2}</p>}
                <p>{[a.city, a.state, a.postalCode].filter(Boolean).join(', ')}</p>
                <p>{a.country}</p>
              </>
            )}
          </address>
        </div>
      </SummarySection>

      {order.notes && (
        <SummarySection title="Delivery instructions">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-850 text-slate-400">
              <Clock className="h-5 w-5" aria-hidden />
            </div>
            <p className="whitespace-pre-line text-body-sm text-slate-400">{order.notes}</p>
          </div>
        </SummarySection>
      )}

      <SummarySection title="Bill summary">
        <OrderTotals order={order} />
      </SummarySection>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancel this order?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={cancelling}>
              Keep order
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelling}>
              Cancel order
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-400">
          This will cancel order {orderRef(order)}. This action cannot be undone.
        </p>
      </Modal>

      {order.manualUpiPayment && (
        <Modal
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          title={tokenRevealed ? (order.manualUpiPayment.tokenVerificationEnabled ? 'Payment token' : 'Thanks — payment noted') : 'Pay via UPI'}
          size="sm"
          dismissible={false}
        >
          {tokenRevealed ? (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <dl className="w-full divide-y divide-ink-700 text-body-sm">
                <div className="flex items-center justify-between py-2">
                  <dt className="text-slate-400">Order ID</dt>
                  <dd className="tabular-nums text-slate-100">{orderRef(order)}</dd>
                </div>
                <div className="flex items-center justify-between py-2">
                  <dt className="text-slate-400">Ordered on</dt>
                  <dd className="text-slate-100">{formatDateTime(order.createdAt)}</dd>
                </div>
                <div className="flex items-center justify-between py-2">
                  <dt className="text-slate-400">Amount</dt>
                  <dd className="text-slate-100">{money(order.manualUpiPayment.amount, order.manualUpiPayment.currency)}</dd>
                </div>
              </dl>
              {order.manualUpiPayment.tokenVerificationEnabled && (
                <div className="w-full rounded-xl border border-primary/40 bg-primary/10 px-5 py-3">
                  <p className="text-overline uppercase text-slate-400">Your payment token</p>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums tracking-wide text-slate-100">
                    {firstName ? `${firstName}: ${order.manualUpiPayment.token}` : order.manualUpiPayment.token}
                  </p>
                </div>
              )}
              <p className="max-w-sm text-caption text-slate-400">
                {order.manualUpiPayment.tokenVerificationEnabled
                  ? "For pickup, quote this token to staff — for delivery, keep it as your reference. We'll email you once payment is confirmed."
                  : "We'll check for your payment and email you once it's confirmed. Nothing else to do."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <img
                src={order.manualUpiPayment.qrDataUri}
                alt="Scan to pay via UPI"
                className="h-56 w-56 rounded-lg border border-ink-700 bg-white p-2"
              />
              <div>
                <p className="text-h3 font-display text-slate-100">{money(order.manualUpiPayment.amount, order.manualUpiPayment.currency)}</p>
                <p className="mt-1 text-body-sm text-slate-400">to {order.manualUpiPayment.vpa}</p>
              </div>
              {confirming ? (
                <div className="flex items-center gap-2 text-body-sm text-slate-400">
                  <Spinner className="h-4 w-4" />
                  Confirming your payment…
                </div>
              ) : showMarkDone ? (
                <Button onClick={handleMarkPaymentDone}>Mark payment done</Button>
              ) : (
                <p className="text-body-sm text-slate-400">Scan the QR and pay the amount above.</p>
              )}
              <p className="max-w-sm text-caption text-slate-400">
                {confirming || showMarkDone
                  ? order.manualUpiPayment.tokenVerificationEnabled
                    ? "Once you've paid, tap Mark payment done to get your token."
                    : "Once you've paid, tap Mark payment done."
                  : 'Scan the QR with any UPI app to pay.'}
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
