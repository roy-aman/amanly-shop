import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { adminOrders } from '@/api/admin';
import type { OrderPaymentStatus, OrderStatus } from '@/lib/types';
import { formatDateTime, money, orderRef, titleCase } from '@/lib/format';
import { Card, EmptyState, Input, PageHeader, Pagination, Select, SkeletonTable } from '@/components/ui';
import { OrderStatusBadge } from '@/components/StatusBadge';

const STATUSES: OrderStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const PAYMENT_STATUSES: OrderPaymentStatus[] = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
const PAGE_SIZE = 15;

export default function AdminOrders() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<OrderPaymentStatus | 'ALL'>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce the free-text search so we don't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'orders', { page, status, paymentStatus, search }],
    queryFn: () =>
      adminOrders.list({
        page,
        size: PAGE_SIZE,
        sort: 'createdAt,desc',
        status: status === 'ALL' ? undefined : status,
        paymentStatus: paymentStatus === 'ALL' ? undefined : paymentStatus,
        search: search || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.content ?? [];
  const hasFilters = status !== 'ALL' || paymentStatus !== 'ALL' || search !== '';

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Every order placed in the store. Filter by status, payment, or customer destination."
      />

      <Card className="p-4">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Search</label>
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, city or country…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Order status</label>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as OrderStatus | 'ALL');
                setPage(0);
              }}
            >
              <option value="ALL">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Payment</label>
            <Select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value as OrderPaymentStatus | 'ALL');
                setPage(0);
              }}
            >
              <option value="ALL">All payments</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <p className="text-xs text-slate-500">
              {data ? `${data.totalElements} order${data.totalElements === 1 ? '' : 's'}` : ''}
            </p>
          </div>
        </div>

        {isLoading ? (
          <SkeletonTable rows={8} columns={7} />
        ) : isError ? (
          <EmptyState title="Could not load orders" message={(error as Error)?.message} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-10 w-10" />}
            title="No orders"
            message={hasFilters ? 'No orders match these filters.' : 'No orders have been placed yet.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Placed</th>
                  <th className="px-3 py-2 font-medium">Items</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Destination</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {rows.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/admin/orders/${o.id}`)}
                    className="cursor-pointer transition hover:bg-ink-800/40"
                  >
                    <td className="px-3 py-3 font-mono text-xs text-slate-300">{orderRef(o)}</td>
                    <td className="px-3 py-3 text-slate-400">{formatDateTime(o.createdAt)}</td>
                    <td className="px-3 py-3 text-slate-300">{o.itemCount}</td>
                    <td className="px-3 py-3 font-medium text-slate-100">{money(o.totalAmount, o.currency)}</td>
                    <td className="px-3 py-3 text-slate-400">{titleCase(o.paymentMethod)}</td>
                    <td className="px-3 py-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-3 py-3 text-slate-400">
                      {[o.shippingCity, o.shippingCountry].filter(Boolean).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && <Pagination page={data.number} totalPages={data.totalPages} onChange={setPage} />}
      </Card>
    </div>
  );
}
