import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageCheck, Truck } from 'lucide-react';
import { adminOrders } from '@/api/admin';
import { ApiError } from '@/lib/http';
import type { OrderStatus, OrderSummaryResponse } from '@/lib/types';
import { formatDateTime, money, orderRef } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { Button, Card, PageHeader } from '@/components/ui';
import { ListSkeleton } from '@/components/RouteSkeletons';

function OrderCard({
  order,
  actionLabel,
  onAction,
  pending,
}: {
  order: OrderSummaryResponse;
  actionLabel: string;
  onAction: () => void;
  pending: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/admin/orders/${order.id}`} className="font-mono text-xs text-gold-400 hover:text-gold-300">
          {orderRef(order)}
        </Link>
        <span className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</span>
      </div>
      <p className="mt-2 text-sm text-slate-300">
        {[order.shippingCity, order.shippingCountry].filter(Boolean).join(', ') || 'No destination'}
      </p>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span className="text-slate-500">
          {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
        </span>
        <span className="font-medium text-slate-100">{money(order.totalAmount, order.currency)}</span>
      </div>
      <Button className="mt-4" size="sm" fullWidth loading={pending} onClick={onAction}>
        {actionLabel}
      </Button>
    </Card>
  );
}

export default function Deliverables() {
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'deliverables'],
    queryFn: () => adminOrders.list({ size: 100, sort: 'createdAt,desc' }),
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => adminOrders.updateStatus(id, status),
    onSuccess: (_data, { status }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'deliverables'] });
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success('Order updated', status === 'SHIPPED' ? 'Marked as shipped.' : 'Marked as delivered.');
    },
    onError: (e) => toast.error('Update failed', e instanceof ApiError ? e.message : 'Could not update the order.'),
  });

  const orders = data?.content ?? [];
  const toShip = orders.filter((o) => o.status === 'PROCESSING');
  const inTransit = orders.filter((o) => o.status === 'SHIPPED');

  const isPendingFor = (id: string) => mutation.isPending && mutation.variables?.id === id;

  if (isLoading) return <ListSkeleton />;

  return (
    <div>
      <PageHeader title="Deliverables" subtitle="Fulfillment board for orders that are processing or in transit." />
      <p className="mb-6 text-xs text-slate-500">
        Based on the latest {orders.length} fetched orders — the API has no status filter, so older orders may not appear.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-200">To ship</h2>
            <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-slate-400">{toShip.length}</span>
          </div>
          {toShip.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-700 bg-ink-900/40 p-6 text-center text-sm text-slate-500">
              Nothing waiting to ship.
            </p>
          ) : (
            <div className="space-y-3">
              {toShip.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  actionLabel="Mark shipped"
                  pending={isPendingFor(o.id)}
                  onAction={() => mutation.mutate({ id: o.id, status: 'SHIPPED' })}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Truck className="h-5 w-5 text-violet-400" />
            <h2 className="text-sm font-semibold text-slate-200">In transit</h2>
            <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-slate-400">{inTransit.length}</span>
          </div>
          {inTransit.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-700 bg-ink-900/40 p-6 text-center text-sm text-slate-500">
              Nothing in transit.
            </p>
          ) : (
            <div className="space-y-3">
              {inTransit.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  actionLabel="Mark delivered"
                  pending={isPendingFor(o.id)}
                  onAction={() => mutation.mutate({ id: o.id, status: 'DELIVERED' })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
