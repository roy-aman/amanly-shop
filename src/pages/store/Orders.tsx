import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { listOrders } from '@/api/orders';
import { money, formatDate } from '@/lib/format';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { Card, EmptyState, LinkButton, PageHeader, Pagination } from '@/components/ui';
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
      <div className="space-y-6">
        <PageHeader title="My orders" />
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="No orders yet"
          message="When you place an order, it will show up here."
          action={<LinkButton to="/products">Start shopping</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My orders" subtitle={`${data.totalElements} order${data.totalElements === 1 ? '' : 's'}`} />

      <div className="space-y-3">
        {data.content.map((o) => (
          <Link key={o.id} to={`/orders/${o.id}`} className="block">
            <Card className="flex flex-col gap-3 p-4 transition hover:border-ink-600 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-200">#{o.id.slice(0, 8)}</span>
                  <OrderStatusBadge status={o.status} />
                </div>
                <p className="text-xs text-slate-500">
                  {formatDate(o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'}
                  {(o.shippingCity || o.shippingCountry) && (
                    <> · {[o.shippingCity, o.shippingCountry].filter(Boolean).join(', ')}</>
                  )}
                </p>
              </div>
              <div className="text-right">
                <span className="text-base font-bold text-gold-300">{money(o.totalAmount, o.currency)}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Pagination page={data.number} totalPages={data.totalPages} onChange={setPage} />
    </div>
  );
}
