import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DollarSign, Receipt, TrendingUp } from 'lucide-react';
import { adminOrders } from '@/api/admin';
import type { OrderStatus, OrderSummaryResponse, PaymentMethod } from '@/lib/types';
import { formatDate, money, titleCase } from '@/lib/format';
import { Card, EmptyState, PageHeader, PageLoader } from '@/components/ui';
import StatCard from '@/components/admin/StatCard';

const CURRENCY = 'USD';
const CAP = 300;
const PAGE_SIZE = 100;

const PALETTE = ['#e0b040', '#34d399', '#38bdf8', '#fb7185', '#a78bfa'];
const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: '#e0b040',
  PROCESSING: '#38bdf8',
  SHIPPED: '#a78bfa',
  DELIVERED: '#34d399',
  CANCELLED: '#fb7185',
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#141a26',
    border: '1px solid #2a3140',
    borderRadius: 12,
    color: '#e2e8f0',
  },
  labelStyle: { color: '#94a3b8' },
};

async function fetchSample(): Promise<OrderSummaryResponse[]> {
  const all: OrderSummaryResponse[] = [];
  let page = 0;
  // Loop pages until the last page or the cap is reached.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await adminOrders.list({ page, size: PAGE_SIZE, sort: 'createdAt,desc' });
    all.push(...res.content);
    if (res.last || all.length >= CAP || res.content.length === 0) break;
    page += 1;
  }
  return all.slice(0, CAP);
}

export default function Reports() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: fetchSample,
  });

  const orders = useMemo(() => data ?? [], [data]);

  const stats = useMemo(() => {
    const active = orders.filter((o) => o.status !== 'CANCELLED');
    const revenue = active.reduce((s, o) => s + o.totalAmount, 0);
    const aov = active.length ? revenue / active.length : 0;
    return { revenue, count: orders.length, aov };
  }, [orders]);

  const byStatus = useMemo(() => {
    const map = new Map<OrderStatus, number>();
    for (const o of orders) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return [...map.entries()].map(([status, value]) => ({ status, name: titleCase(status), value }));
  }, [orders]);

  const overTime = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      const key = o.createdAt.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, orders]) => ({ date, label: formatDate(date), orders }));
  }, [orders]);

  const byPayment = useMemo(() => {
    const map = new Map<PaymentMethod, number>();
    for (const o of orders) map.set(o.paymentMethod, (map.get(o.paymentMethod) ?? 0) + 1);
    return [...map.entries()].map(([method, value]) => ({ name: titleCase(method), value }));
  }, [orders]);

  const byCountry = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      const key = o.shippingCountry || 'Unknown';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([country, value]) => ({ country, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [orders]);

  if (isLoading) return <PageLoader />;
  if (isError) {
    return <EmptyState title="Could not load reports" message={(error as Error)?.message} />;
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Analytics derived from order data." />
      <p className="mb-6 text-xs text-slate-500">
        Based on a sample of the most recent {orders.length} order{orders.length === 1 ? '' : 's'} (capped at {CAP}).
        The API has no analytics endpoint, so these figures are computed client-side and are not all-time totals.
      </p>

      {orders.length === 0 ? (
        <EmptyState title="No data yet" message="Reports will populate once orders start coming in." />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Revenue (sample)"
              value={money(stats.revenue, CURRENCY)}
              tone="gold"
              icon={<DollarSign className="h-5 w-5" />}
              hint="Excludes cancelled orders"
            />
            <StatCard
              label="Orders (sample)"
              value={stats.count}
              tone="blue"
              icon={<Receipt className="h-5 w-5" />}
            />
            <StatCard
              label="Avg. order value"
              value={money(stats.aov, CURRENCY)}
              tone="green"
              icon={<TrendingUp className="h-5 w-5" />}
              hint="Non-cancelled orders"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Orders by status */}
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-200">Orders by status</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byStatus} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3140" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#2a3140" />
                    <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#2a3140" />
                    <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} {...TOOLTIP_STYLE} />
                    <Bar dataKey="value" name="Orders" radius={[4, 4, 0, 0]}>
                      {byStatus.map((d) => (
                        <Cell key={d.status} fill={STATUS_COLORS[d.status]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Payment method split */}
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-200">Payment method split</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byPayment} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {byPayment.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Orders over time */}
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-200">Orders over time</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overTime} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reportOrdersFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3140" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#2a3140" />
                  <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#2a3140" />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="orders" stroke="#38bdf8" strokeWidth={2} fill="url(#reportOrdersFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Orders by country */}
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-200">Orders by country</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCountry} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3140" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#2a3140" />
                  <YAxis
                    type="category"
                    dataKey="country"
                    width={90}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    stroke="#2a3140"
                  />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} {...TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Orders" fill="#a78bfa" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
