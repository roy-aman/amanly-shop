import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, DollarSign, Receipt, ShoppingBag, TrendingUp } from 'lucide-react';
import { adminStats } from '@/api/stats';
import { getPublicStore } from '@/api/store';
import type { OrderStatus, RevenueGranularity } from '@/lib/types';
import { formatDate, money, titleCase } from '@/lib/format';
import { trailingRange } from '@/lib/dateRange';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ThemedAreaChart,
  ThemedBarChart,
  cn,
  type Column,
} from '@/components/ui';
import { DashboardSkeleton } from '@/components/RouteSkeletons';
import { ProductStatusBadge } from '@/components/StatusBadge';
import DateRangeControl from '@/components/admin/DateRangeControl';
import MetricTile from '@/components/admin/MetricTile';

const STATUS_ORDER: OrderStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const GRANULARITIES: { value: RevenueGranularity; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/** Client-side CSV export of already-fetched stats (no server export endpoint). */
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [rangeDays, setRangeDays] = useState(30);
  const [granularity, setGranularity] = useState<RevenueGranularity>('day');
  const range = trailingRange(rangeDays);

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
    queryFn: () => adminStats.topProducts({ ...range, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const lowStockQ = useQuery({
    queryKey: ['admin', 'stats', 'low-stock'],
    queryFn: () => adminStats.lowStock({ threshold: 5, limit: 50 }),
  });

  if (overviewQ.isPending) return <DashboardSkeleton />;
  if (overviewQ.isError) {
    return (
      <div>
        <PageHeader title="Reports" />
        <EmptyState title="Could not load reports" message={(overviewQ.error as Error)?.message} />
      </div>
    );
  }

  const ov = overviewQ.data;
  const series = seriesQ.data?.points ?? [];
  const top = topQ.data ?? [];
  const lowStock = lowStockQ.data ?? [];
  const statusData = STATUS_ORDER.map((s) => ({ status: titleCase(s), orders: ov.ordersByStatus[s] ?? 0 }));

  const exportOverview = () =>
    downloadCsv(
      `overview_${range.from}_${range.to}.csv`,
      ['metric', 'current', 'previous', 'changePct'],
      [
        ['Revenue', ov.revenue.current, ov.revenue.previous, ov.revenue.changePct ?? ''],
        ['Paid orders', ov.paidOrders.current, ov.paidOrders.previous, ov.paidOrders.changePct ?? ''],
        ['Total orders', ov.totalOrders.current, ov.totalOrders.previous, ov.totalOrders.changePct ?? ''],
        ['Customers', ov.customers.current, ov.customers.previous, ov.customers.changePct ?? ''],
        ['Avg order value', ov.averageOrderValue.current, ov.averageOrderValue.previous, ov.averageOrderValue.changePct ?? ''],
        ...STATUS_ORDER.map((s) => [`Orders: ${titleCase(s)}`, ov.ordersByStatus[s] ?? 0, '', ''] as (string | number)[]),
      ],
    );

  const exportRevenue = () =>
    downloadCsv(
      `revenue_${granularity}_${range.from}_${range.to}.csv`,
      ['periodStart', 'revenue', 'orderCount'],
      series.map((p) => [p.periodStart, p.revenue, p.orderCount]),
    );

  const exportTopProducts = () =>
    downloadCsv(
      `top-products_${range.from}_${range.to}.csv`,
      ['productId', 'name', 'slug', 'unitsSold', 'revenue'],
      top.map((p) => [p.productId, p.name, p.slug ?? '', p.unitsSold, p.revenue]),
    );

  const topColumns: Column<(typeof top)[number]>[] = [
    { key: 'name', header: 'Product', render: (p) => <span className="text-slate-200">{p.name}</span> },
    { key: 'unitsSold', header: 'Units sold', align: 'right', render: (p) => p.unitsSold },
    { key: 'revenue', header: 'Revenue', align: 'right', render: (p) => money(p.revenue, currency) },
  ];

  const lowStockColumns: Column<(typeof lowStock)[number]>[] = [
    { key: 'name', header: 'Product', render: (p) => <span className="text-slate-200">{p.name}</span> },
    { key: 'sku', header: 'SKU', render: (p) => <span className="font-mono text-xs text-slate-400">{p.sku}</span> },
    { key: 'stockQuantity', header: 'Stock', align: 'right', render: (p) => p.stockQuantity },
    { key: 'status', header: 'Status', align: 'right', render: (p) => <ProductStatusBadge status={p.status} /> },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Reports" subtitle={`Analytics for the last ${rangeDays} days (${range.from} → ${range.to}).`} />
        <DateRangeControl value={rangeDays} onChange={setRangeDays} className="mt-1" />
      </div>

      <Tabs defaultValue="sales" className="mt-2">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>

        {/* ── Sales: KPI tiles + orders by status ─────────────────────── */}
        <TabsContent value="sales">
          <div className="mb-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={exportOverview}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Revenue" changePct={ov.revenue.changePct} icon={<DollarSign className="h-5 w-5" />} value={money(ov.revenue.current, currency)} />
            <MetricTile label="Total orders" changePct={ov.totalOrders.changePct} icon={<Receipt className="h-5 w-5" />} value={ov.totalOrders.current} />
            <MetricTile label="Paid orders" changePct={ov.paidOrders.changePct} icon={<ShoppingBag className="h-5 w-5" />} value={ov.paidOrders.current} />
            <MetricTile label="Avg. order value" changePct={ov.averageOrderValue.changePct} icon={<TrendingUp className="h-5 w-5" />} value={money(ov.averageOrderValue.current, currency)} />
          </div>
          <Card className="mt-6 p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-200">Orders by status</h2>
            <ThemedBarChart data={statusData} xKey="status" series={[{ key: 'orders', name: 'Orders' }]} height={280} />
          </Card>
        </TabsContent>

        {/* ── Revenue: time series ────────────────────────────────────── */}
        <TabsContent value="revenue">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Granularity" className="inline-flex rounded-xl border border-ink-700 bg-ink-900/60 p-1">
              {GRANULARITIES.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  aria-pressed={g.value === granularity}
                  onClick={() => setGranularity(g.value)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                    g.value === granularity ? 'bg-gold-400/15 text-gold-200' : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={exportRevenue} disabled={series.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-200">Paid revenue over time</h2>
            {seriesQ.isPending ? (
              <div className="h-72 animate-pulse rounded-xl bg-ink-800/50" />
            ) : series.length === 0 || series.every((p) => p.revenue === 0) ? (
              <div className="py-16 text-center text-sm text-slate-500">No paid revenue in this range yet.</div>
            ) : (
              <ThemedAreaChart
                data={series as unknown as Array<Record<string, unknown>>}
                xKey="periodStart"
                series={[{ key: 'revenue', name: 'Revenue' }]}
                height={288}
                xTickFormatter={(v) => formatDate(v as string)}
                valueFormatter={(v) => money(Number(v), currency)}
              />
            )}
          </Card>
        </TabsContent>

        {/* ── Products: top sellers + low stock ───────────────────────── */}
        <TabsContent value="products">
          <div className="space-y-6">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">Top products</h2>
                <Button variant="outline" size="sm" onClick={exportTopProducts} disabled={top.length === 0}>
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
              </div>
              <DataTable
                columns={topColumns}
                data={top}
                getRowKey={(p) => p.productId}
                loading={topQ.isPending}
                empty={<EmptyState title="No sales yet" message="Best-sellers appear once orders are paid." />}
              />
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-200">Low stock</h2>
              <DataTable
                columns={lowStockColumns}
                data={lowStock}
                getRowKey={(p) => p.productId}
                loading={lowStockQ.isPending}
                empty={<EmptyState title="Stock looks healthy" message="No products at or below the low-stock threshold." />}
              />
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
