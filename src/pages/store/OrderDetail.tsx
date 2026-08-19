import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Clock, MapPin, PackageX } from 'lucide-react';
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
export default function OrderDetail() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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

      <SummarySection title="Delivery address">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400/10 text-brand-ink">
            <MapPin className="h-5 w-5" aria-hidden />
          </div>
          <address className="min-w-0 space-y-0.5 text-body-sm not-italic text-slate-400">
            <p className="font-medium text-slate-100">{a.name}</p>
            {a.phone && <p>{a.phone}</p>}
            <p>{a.addressLine1}</p>
            {a.addressLine2 && <p>{a.addressLine2}</p>}
            <p>{[a.city, a.state, a.postalCode].filter(Boolean).join(', ')}</p>
            <p>{a.country}</p>
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
    </div>
  );
}
