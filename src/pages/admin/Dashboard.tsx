import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertTriangle, DollarSign, Package, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { adminOrders } from '@/api/admin';
import { adminStats } from '@/api/stats';
import { getPublicStore } from '@/api/store';
import type { LowStockProduct, TopProductStat } from '@/lib/types';
import { formatDate, money, orderRef } from '@/lib/format';
import { trailingRange } from '@/lib/dateRange';
import { Card, DataTable, EmptyState, PageHeader, ThemedAreaChart, type Column } from '@/components/ui';
import { DashboardSkeleton } from '@/components/RouteSkeletons';
import { OrderStatusBadge, ProductStatusBadge } from '@/components/StatusBadge';
import DateRangeControl from '@/components/admin/DateRangeControl';
import MetricTile from '@/components/admin/MetricTile';

export default function Dashboard() {
  const [rangeDays, setRangeDays] = useState(30);
  const range = trailingRange(rangeDays);
  // Daily buckets for short windows, weekly once the range gets long enough that
  // daily points would be noise.
  const granularity = rangeDays > 60 ? 'week' : 'day';

  const storeQ = useQuery({ queryKey: ['public-store'], queryFn: getPublicStore, staleTime: 5 * 60_000 });
  const currency = storeQ.data?.currency ?? 'USD';

  const overviewQ = useQuery({
    queryKey: ['admin', 'stats', 'overview', range.from, range.to],
    queryFn: () => adminStats.overview(range),
    placeholderData: keepPreviousData,
  });
  const seriesQ = useQuery({
    queryKey: ['admin', 'stats', 'revenue-series', range.from, range.to, granularity],
    queryFn: () => adminStats.revenueSeries({ ...range, granularity }),
    placeholderData: keepPreviousData,
  });
  const topQ = useQuery({
    queryKey: ['admin', 'stats', 'top-products', range.from, range.to],
    queryFn: () => adminStats.topProducts({ ...range, limit: 8 }),
    placeholderData: keepPreviousData,
  });
  const lowStockQ = useQuery({
    queryKey: ['admin', 'stats', 'low-stock'],
    queryFn: () => adminStats.lowStock({ threshold: 5, limit: 10 }),
  });
  // Recent orders is legitimately a list (not a stat) — keep the list endpoint.
  const recentQ = useQuery({
    queryKey: ['admin', 'dashboard', 'recent-orders'],
    queryFn: () => adminOrders.list({ size: 8, sort: 'createdAt,desc' }),
  });

  if (overviewQ.isPending) return <DashboardSkeleton />;
  if (overviewQ.isError) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <EmptyState title="Could not load stats" message={(overviewQ.error as Error)?.message} />
      </div>
    );
  }

  const ov = overviewQ.data;
  const series = seriesQ.data?.points ?? [];
  const top = topQ.data ?? [];
  const lowStock = lowStockQ.data ?? [];
  const recentOrders = recentQ.data?.content ?? [];

  const topColumns: Column<TopProductStat>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (p) =>
        p.slug ? (
          <Link to={`/products/${p.slug}`} className="text-slate-200 hover:text-gold-300">
            {p.name}
          </Link>
        ) : (
          <span className="text-slate-300">{p.name}</span>
        ),
    },
    { key: 'unitsSold', header: 'Units', align: 'right', render: (p) => p.unitsSold },
    { key: 'revenue', header: 'Revenue', align: 'right', render: (p) => money(p.revenue, currency) },
  ];

  const lowStockColumns: Column<LowStockProduct>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate text-slate-200">{p.name}</p>
          <p className="truncate font-mono text-xs text-slate-500">{p.sku}</p>
        </div>
      ),
    },
    { key: 'stockQuantity', header: 'Stock', align: 'right', render: (p) => p.stockQuantity },
    { key: 'status', header: 'Status', align: 'right', render: (p) => <ProductStatusBadge status={p.status} /> },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Dashboard" subtitle={`Store performance for the last ${rangeDays} days.`} />
        <DateRangeControl value={rangeDays} onChange={setRangeDays} className="mt-1" />
      </div>

      {/* KPI tiles with period-over-period deltas */}
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Revenue"
          changePct={ov.revenue.changePct}
          icon={<DollarSign className="h-5 w-5" />}
          value={money(ov.revenue.current, currency)}
        />
        <MetricTile
          label="Paid orders"
          changePct={ov.paidOrders.changePct}
          icon={<ShoppingBag className="h-5 w-5" />}
          value={ov.paidOrders.current}
        />
        <MetricTile
          label="Customers"
          changePct={ov.customers.changePct}
          icon={<Users className="h-5 w-5" />}
          value={ov.customers.current}
        />
        <MetricTile
          label="Avg. order value"
          changePct={ov.averageOrderValue.changePct}
          icon={<TrendingUp className="h-5 w-5" />}
          value={money(ov.averageOrderValue.current, currency)}
        />
      </div>

      {/* Revenue chart + recent orders */}
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Revenue</h2>
            <span className="text-xs text-slate-500">Paid orders, by {granularity}</span>
          </div>
          {seriesQ.isPending ? (
            <div className="h-64 animate-pulse rounded-xl bg-ink-800/50" />
          ) : series.length === 0 || series.every((p) => p.revenue === 0) ? (
            <div className="py-14 text-center text-sm text-slate-500">No paid revenue in this range yet.</div>
          ) : (
            <ThemedAreaChart
              data={series as unknown as Array<Record<string, unknown>>}
              xKey="periodStart"
              series={[{ key: 'revenue', name: 'Revenue' }]}
              height={256}
              xTickFormatter={(v) => formatDate(v as string)}
              valueFormatter={(v) => money(Number(v), currency)}
            />
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Recent orders</h2>
            <Link to="/admin/orders" className="text-xs font-medium text-gold-400 hover:text-gold-300">
              View all
            </Link>
          </div>
          {recentQ.isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-ink-800/50" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <EmptyState title="No orders yet" message="New orders will appear here." />
          ) : (
            <ul className="divide-y divide-ink-800">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    to={`/admin/orders/${o.id}`}
                    className="flex items-center justify-between gap-3 py-3 transition hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-slate-400">{orderRef(o)}</p>
                      <p className="text-sm text-slate-200">{money(o.totalAmount, o.currency)}</p>
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Top products + low stock */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Top products</h2>
          <DataTable
            columns={topColumns}
            data={top}
            getRowKey={(p) => p.productId}
            loading={topQ.isPending}
            loadingRows={5}
            empty={<EmptyState icon={<Package className="h-8 w-8" />} title="No sales yet" message="Best-sellers appear once orders are paid." />}
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Low stock</h2>
          <DataTable
            columns={lowStockColumns}
            data={lowStock}
            getRowKey={(p) => p.productId}
            loading={lowStockQ.isPending}
            loadingRows={5}
            empty={<EmptyState icon={<AlertTriangle className="h-8 w-8" />} title="Stock looks healthy" message="No products at or below the low-stock threshold." />}
          />
        </Card>
      </div>
    </div>
  );
}
