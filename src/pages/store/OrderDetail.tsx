import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Clock, MapPin, PackageX, QrCode, Store as StoreIcon } from 'lucide-react';
import { getOrder, cancelOrder } from '@/api/orders';
import { ApiError } from '@/lib/http';
import { formatDateTime, money, orderRef, titleCase } from '@/lib/format';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { OrderTotals } from '@/components/OrderTotals';
import { Divided, InfoRow, OrderLine, SummarySection } from '@/components/summary';
import { useToast } from '@/context/ToastContext';
import { Button, EmptyState, LinkButton, Modal } from '@/components/ui';
import { DetailSkeleton } from '@/components/RouteSkeletons';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

/**
 * A placed order, laid out as the receipt it is: a narrow stack of labelled blocks — what was
 * bought, the order's facts, where it goes, what it cost.
 *
 * <p>It used to be a four-column table inside a two-column grid, which is an admin screen. The
 * figures were the same; finding any one of them meant reading across. Capping the column keeps the
 * eye travelling down a single edge, which is why receipts have always been narrow.
 */
/** Drops the 3-letter name prefix from a token like `AMA-JC5N2`, for display next to the
 *  customer's own full first name instead of the abbreviated one. */
function tokenBody(token: string): string {
  return token.split('-').pop() ?? token;
}

export default function OrderDetail() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [showMarkDone, setShowMarkDone] = useState(false);
  const [tokenRevealed, setTokenRevealed] = useState(false);

  // Give the customer a few seconds with just the QR before offering "I've paid" — the
  // token is a receipt for a payment that's supposedly already happened, not something to
  // rush to before scanning.
  useEffect(() => {
    if (!qrOpen) {
      setShowMarkDone(false);
      setTokenRevealed(false);
      return;
    }
    const timer = setTimeout(() => setShowMarkDone(true), 5000);
    return () => clearTimeout(timer);
  }, [qrOpen]);

  const orderQuery = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const order = orderQuery.data;

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
  const canCancel = order.status === 'PENDING' || order.status === 'PROCESSING';
  const itemCount = order.items.reduce((n, it) => n + it.quantity, 0);
  const firstName = a.name?.trim().split(/\s+/)[0];

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
              {titleCase(order.paymentMethod)}
              <PaymentStatusBadge status={order.paymentStatus} />
            </span>
          </InfoRow>
          <InfoRow label="Last updated">{formatDateTime(order.updatedAt)}</InfoRow>
        </dl>
      </SummarySection>

      {order.manualUpiPayment && (
        <SummarySection title="Pay via UPI">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400/10 text-brand-ink">
              <QrCode className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 text-body-sm text-slate-400">
              <p className="font-medium text-slate-100">
                {money(order.manualUpiPayment.amount, order.manualUpiPayment.currency)}
                {firstName && <> — token for {firstName}</>}
              </p>
              <p>Awaiting payment. Scan the QR to pay, or quote your token to staff.</p>
            </div>
            <Button size="sm" onClick={() => setQrOpen(true)} className="shrink-0">
              Show QR to pay
            </Button>
          </div>
        </SummarySection>
      )}

      {!order.manualUpiPayment && order.manualUpiToken && (
        <SummarySection title="Manual UPI payment">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400/10 text-brand-ink">
              <QrCode className="h-5 w-5" aria-hidden />
            </div>
            <div className="text-body-sm text-slate-400">
              <p className="font-medium text-slate-100">
                {firstName ? `Token for ${firstName}` : 'Token'}: {firstName ? tokenBody(order.manualUpiToken) : order.manualUpiToken}
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
        <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="Pay via UPI" size="sm">
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
            {tokenRevealed ? (
              <div className="rounded-xl border border-primary/40 bg-primary/10 px-5 py-3">
                <p className="text-overline uppercase text-slate-400">
                  {firstName ? `Token for ${firstName}` : 'Your payment token'}
                </p>
                <p className="mt-1 font-display text-h3 tabular-nums text-slate-100">
                  {firstName ? tokenBody(order.manualUpiPayment.token) : order.manualUpiPayment.token}
                </p>
              </div>
            ) : showMarkDone ? (
              <Button onClick={() => setTokenRevealed(true)}>Mark payment done</Button>
            ) : (
              <p className="text-body-sm text-slate-400">Scan the QR and pay the amount above.</p>
            )}
            <p className="max-w-sm text-caption text-slate-400">
              {tokenRevealed
                ? 'For pickup, quote this token to staff — for delivery, keep it as your reference. ' +
                  "We'll email you once payment is confirmed."
                : "Once you've paid, tap Mark payment done to get your token."}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
