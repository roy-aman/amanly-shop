import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { listOrders } from '@/api/orders';
import { money, formatDate } from '@/lib/format';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { EmptyState, LinkButton, Pagination } from '@/components/ui';
import { ListSkeleton } from '@/components/RouteSkeletons';

export default function Orders() {
  const [page, setPage] = useState(0);

  const ordersQuery = useQuery({
    queryKey: ['orders', page],
    queryFn: () => listOrders({ page, size: 10, sort: 'createdAt,desc' }),
    placeholderData: keepPreviousData,
  });

  const data = ordersQuery.data;

  if (ordersQuery.isLoading) return <ListSkeleton />;

  if (!data || data.content.length === 0) {
    return (
      <div>
        <h1 className="border-b border-ink-700 pb-6 font-display text-h1 text-slate-100">Orders</h1>
        <div className="py-16">
          <EmptyState
            icon={<Package className="h-10 w-10" />}
            title="No orders yet"
            message="When you place an order, it will show up here."
            action={<LinkButton to="/products">Start shopping</LinkButton>}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-ink-700 pb-6">
        <h1 className="font-display text-h1 text-slate-100">Orders</h1>
        <p className="mt-2 text-body-sm text-slate-400">
          {data.totalElements} {data.totalElements === 1 ? 'order' : 'orders'}
        </p>
      </header>

      {/* A ledger of hairline rows rather than a stack of cards: orders are a
          list to scan down, and card chrome on each one fights that. */}
      <div className="divide-y divide-ink-700 border-b border-ink-700">
        {data.content.map((o) => (
          <Link
            key={o.id}
            to={`/orders/${o.id}`}
            className="flex flex-col gap-3 py-5 transition-colors hover:bg-ink-850 sm:flex-row sm:items-center sm:justify-between sm:px-2"
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                {/* The order number is what a customer quotes back; eight characters of a UUID is
                    not something anyone can read down a phone. Older orders have none. */}
                <span className="font-mono text-body-sm text-slate-100">
                  {o.orderNumber ?? `#${o.id.slice(0, 8)}`}
                </span>
                <OrderStatusBadge status={o.status} audience="customer" />
              </div>
              <p className="text-caption text-slate-500">
                {formatDate(o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'}
                {(o.shippingCity || o.shippingCountry) && (
                  <> · {[o.shippingCity, o.shippingCountry].filter(Boolean).join(', ')}</>
                )}
              </p>
            </div>
            <span className="text-body-sm font-semibold text-slate-100 sm:text-right">
              {money(o.totalAmount, o.currency)}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <Pagination page={data.number} totalPages={data.totalPages} onChange={setPage} />
      </div>
    </div>
  );
}
