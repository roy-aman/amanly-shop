import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin } from 'lucide-react';
import { adminOrders } from '@/api/admin';
import { ApiError } from '@/lib/http';
import type { OrderPaymentStatus, OrderStatus } from '@/lib/types';
import { formatDateTime, money, titleCase } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { Button, Card, EmptyState, Modal, PageHeader } from '@/components/ui';
import { DetailSkeleton } from '@/components/RouteSkeletons';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { OrderTotals } from '@/components/OrderTotals';

const NEXT_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export default function AdminOrderDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState(false);

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: () => adminOrders.get(id),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: (status: OrderStatus) => adminOrders.updateStatus(id, status),
    onSuccess: (_data, status) => {
      qc.invalidateQueries({ queryKey: ['admin', 'order', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success('Order updated', `Status changed to ${titleCase(status)}.`);
      setConfirmCancel(false);
    },
    onError: (e) => {
      toast.error('Update failed', e instanceof ApiError ? e.message : 'Could not update the order.');
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (paymentStatus: OrderPaymentStatus) => adminOrders.updatePaymentStatus(id, paymentStatus),
    onSuccess: (_data, paymentStatus) => {
      qc.invalidateQueries({ queryKey: ['admin', 'order', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success('Payment updated', `Payment marked ${titleCase(paymentStatus)}.`);
      setConfirmRefund(false);
    },
    onError: (e) => {
      toast.error('Update failed', e instanceof ApiError ? e.message : 'Could not update the payment.');
    },
  });

  useDocumentTitle(order ? `Order #${order.id.slice(0, 8)}` : 'Order');

  if (isLoading) return <DetailSkeleton />;
  if (isError || !order) {
    return (
      <EmptyState
        title="Order not found"
        message={(error as Error)?.message ?? 'This order could not be loaded.'}
        action={
          <Link to="/admin/orders" className="text-sm text-gold-400 hover:text-gold-300">
            Back to orders
          </Link>
        }
      />
    );
  }

  const transitions = NEXT_TRANSITIONS[order.status];
  const addr = order.shippingAddress;

  return (
    <div>
      <Link to="/admin/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <PageHeader
        title={`Order #${order.id.slice(0, 8)}`}
        subtitle={`Placed ${formatDateTime(order.createdAt)}`}
        action={
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Items */}
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-200">Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-2 py-2 font-medium">Product</th>
                    <th className="px-2 py-2 font-medium">SKU</th>
                    <th className="px-2 py-2 font-medium text-right">Unit</th>
                    <th className="px-2 py-2 font-medium text-right">Qty</th>
                    <th className="px-2 py-2 font-medium text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {order.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-2 py-3 text-slate-200">
                        {it.productName}
                        {it.variantOptions && (
                          <span className="mt-0.5 block text-xs text-slate-400">{it.variantOptions}</span>
                        )}
                      </td>
                      <td className="px-2 py-3 font-mono text-xs text-slate-500">{it.variantSku ?? it.sku}</td>
                      <td className="px-2 py-3 text-right text-slate-400">{money(it.unitPrice, order.currency)}</td>
                      <td className="px-2 py-3 text-right text-slate-300">{it.quantity}</td>
                      <td className="px-2 py-3 text-right font-medium text-slate-100">
                        {money(it.subtotal, order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-ink-700 px-2 py-4">
              <OrderTotals order={order} className="w-full max-w-xs" />
            </div>
            {order.notes && (
              <p className="mt-4 rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm text-slate-400">
                <span className="font-medium text-slate-300">Notes: </span>
                {order.notes}
              </p>
            )}
          </Card>

          {/* Shipping */}
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <MapPin className="h-4 w-4 text-gold-400" /> Shipping address
            </h2>
            <div className="space-y-0.5 text-sm text-slate-300">
              <p className="font-medium text-slate-100">{addr.name}</p>
              {addr.phone && <p className="text-slate-400">{addr.phone}</p>}
              <p>{addr.addressLine1}</p>
              {addr.addressLine2 && <p>{addr.addressLine2}</p>}
              <p>
                {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
              </p>
              <p>{addr.country}</p>
            </div>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-200">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Payment method</dt>
                <dd className="text-slate-300">{titleCase(order.paymentMethod)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Payment status</dt>
                <dd><PaymentStatusBadge status={order.paymentStatus} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Order status</dt>
                <dd><OrderStatusBadge status={order.status} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-300">{formatDateTime(order.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Updated</dt>
                <dd className="text-slate-300">{formatDateTime(order.updatedAt)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-700 pt-2">
                <dt className="font-medium text-slate-300">Total</dt>
                <dd className="font-bold text-gold-300">{money(order.totalAmount, order.currency)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-200">Manage status</h2>
            <p className="mb-4 text-xs text-slate-500">Current: {titleCase(order.status)}</p>
            {transitions.length === 0 ? (
              <p className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm text-slate-400">
                No further transitions available from {titleCase(order.status)}.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {transitions.map((next) =>
                  next === 'CANCELLED' ? (
                    <Button
                      key={next}
                      variant="danger"
                      fullWidth
                      loading={mutation.isPending && mutation.variables === 'CANCELLED'}
                      onClick={() => setConfirmCancel(true)}
                    >
                      Cancel order
                    </Button>
                  ) : (
                    <Button
                      key={next}
                      variant="primary"
                      fullWidth
                      loading={mutation.isPending && mutation.variables === next}
                      onClick={() => mutation.mutate(next)}
                    >
                      Mark {titleCase(next)}
                    </Button>
                  ),
                )}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-200">Manage payment</h2>
            <p className="mb-4 flex items-center gap-2 text-xs text-slate-500">
              Current: <PaymentStatusBadge status={order.paymentStatus} />
            </p>
            {order.paymentStatus === 'PENDING' || order.paymentStatus === 'FAILED' ? (
              <Button
                variant="primary"
                fullWidth
                loading={paymentMutation.isPending && paymentMutation.variables === 'PAID'}
                onClick={() => paymentMutation.mutate('PAID')}
              >
                Mark as paid
              </Button>
            ) : order.paymentStatus === 'PAID' ? (
              <Button
                variant="danger"
                fullWidth
                loading={paymentMutation.isPending && paymentMutation.variables === 'REFUNDED'}
                onClick={() => setConfirmRefund(true)}
              >
                Mark refunded
              </Button>
            ) : (
              <p className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm text-slate-400">
                This order has been refunded — no further payment actions.
              </p>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this order?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Keep order
            </Button>
            <Button variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate('CANCELLED')}>
              Cancel order
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-400">
          Cancelling order <span className="font-mono text-slate-300">#{order.id.slice(0, 8)}</span> will restore
          reserved stock for its items. This cannot be undone.
        </p>
      </Modal>

      <Modal
        open={confirmRefund}
        onClose={() => setConfirmRefund(false)}
        title="Mark order refunded?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmRefund(false)}>
              Keep as paid
            </Button>
            <Button variant="danger" loading={paymentMutation.isPending} onClick={() => paymentMutation.mutate('REFUNDED')}>
              Mark refunded
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-400">
          This records order <span className="font-mono text-slate-300">#{order.id.slice(0, 8)}</span> as refunded.
          It updates the payment status only — issue the actual refund through your payment provider separately.
        </p>
      </Modal>
    </div>
  );
}
