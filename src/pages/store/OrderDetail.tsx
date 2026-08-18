import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageX } from 'lucide-react';
import { getOrder, cancelOrder } from '@/api/orders';
import { ApiError } from '@/lib/http';
import { money, formatDateTime, titleCase } from '@/lib/format';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { OrderTotals } from '@/components/OrderTotals';
import { useToast } from '@/context/ToastContext';
import { Button, EmptyState, LinkButton, Modal } from '@/components/ui';
import { DetailSkeleton } from '@/components/RouteSkeletons';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

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

  useDocumentTitle(order ? `Order #${order.id.slice(0, 8)}` : 'Order');

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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-700 pb-6">
        <div>
          <h1 className="font-display text-h1 text-slate-100">Order #{order.id.slice(0, 8)}</h1>
          <p className="mt-2 text-body-sm text-slate-400">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        {canCancel && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="rounded text-body-sm text-slate-500 underline-offset-4 transition hover:text-danger-300 hover:underline"
          >
            Cancel order
          </button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} audience="customer" />
        <PaymentStatusBadge status={order.paymentStatus} />
        <span className="text-xs text-slate-500">Payment: {titleCase(order.paymentMethod)}</span>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_20rem]">
        {/* Items */}
        <div className="space-y-10">
          <div className="border-y border-ink-700">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-700 text-left text-overline uppercase text-slate-500">
                    <th className="px-2 py-4 font-medium">Item</th>
                    <th className="px-2 py-4 text-right font-medium">Price</th>
                    <th className="px-2 py-4 text-right font-medium">Qty</th>
                    <th className="px-2 py-4 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it) => (
                    <tr key={it.id} className="border-b border-ink-700 last:border-0">
                      <td className="px-2 py-4">
                        <div className="font-medium text-slate-100">{it.productName}</div>
                        {it.variantOptions && <div className="text-xs text-slate-300">{it.variantOptions}</div>}
                        <div className="text-xs text-slate-500">SKU: {it.variantSku ?? it.sku}</div>
                      </td>
                      <td className="px-2 py-4 text-right text-slate-300">{money(it.unitPrice, order.currency)}</td>
                      <td className="px-2 py-4 text-right text-slate-300">{it.quantity}</td>
                      <td className="px-2 py-4 text-right font-medium text-slate-100">{money(it.subtotal, order.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <OrderTotals order={order} className="border-t border-ink-700 px-2 py-5" />
          </div>

          {order.notes && (
            <div className="bg-ink-850 p-6">
              <h2 className="mb-2 text-overline uppercase text-slate-500">Order notes</h2>
              <p className="whitespace-pre-line text-body-sm text-slate-400">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Shipping + meta */}
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-overline uppercase text-slate-500">Shipping address</h2>
            <address className="space-y-0.5 text-sm not-italic text-slate-300">
              <p className="font-medium text-slate-100">{a.name}</p>
              {a.phone && <p className="text-slate-400">{a.phone}</p>}
              <p>{a.addressLine1}</p>
              {a.addressLine2 && <p>{a.addressLine2}</p>}
              <p>
                {[a.city, a.state, a.postalCode].filter(Boolean).join(', ')}
              </p>
              <p>{a.country}</p>
            </address>
          </div>

          <div className="border-t border-ink-700 pt-5 text-body-sm text-slate-500">
            <div className="flex justify-between py-1">
              <span>Placed</span>
              <span className="text-slate-300">{formatDateTime(order.createdAt)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Last updated</span>
              <span className="text-slate-300">{formatDateTime(order.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>

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
          This will cancel order #{order.id.slice(0, 8)}. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
