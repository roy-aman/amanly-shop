import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Clock, DollarSign, Package, ShoppingBag, Users } from 'lucide-react';
import { adminOrders, adminProducts, adminUsers } from '@/api/admin';
import type { OrderSummaryResponse } from '@/lib/types';
import { formatDate, money } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { Card, EmptyState, PageHeader, PageLoader } from '@/components/ui';
import { OrderStatusBadge } from '@/components/StatusBadge';
import StatCard from '@/components/admin/StatCard';

const CURRENCY = 'USD';

function groupByDay(orders: OrderSummaryResponse[]): { date: string; label: string; orders: number }[] {
  const map = new Map<string, number>();
  for (const o of orders) {
    const key = o.createdAt.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, label: formatDate(date), orders: count }));
}

export default function Dashboard() {
  const { isAdmin } = useAuth();

  const ordersQ = useQuery({
    queryKey: ['admin', 'dashboard', 'orders'],
    queryFn: () => adminOrders.list({ size: 100, sort: 'createdAt,desc' }),
  });
  const productsQ = useQuery({
    queryKey: ['admin', 'dashboard', 'products'],
    queryFn: () => adminProducts.list({ size: 100 }),
  });
  // STAFF cannot call the users endpoint — only fire it for admins.
  const usersQ = useQuery({
    queryKey: ['admin', 'dashboard', 'users'],
    queryFn: () => adminUsers.list({ size: 1 }),
    enabled: isAdmin,
  });

  const orders = ordersQ.data?.content ?? [];
  const products = productsQ.data?.content ?? [];

  const revenueRecent = useMemo(
    () => orders.filter((o) => o.status !== 'CANCELLED').reduce((sum, o) => sum + o.totalAmount, 0),
    [orders],
  );
  const pendingCount = useMemo(() => orders.filter((o) => o.status === 'PENDING').length, [orders]);
  const lowStock = useMemo(() => products.filter((p) => p.stockQuantity <= 5).length, [products]);
  const chartData = useMemo(() => groupByDay(orders), [orders]);
  const recentOrders = orders.slice(0, 8);

  if (ordersQ.isLoading || productsQ.isLoading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Figures below reflect recent activity (the latest fetched orders/products), not all-time totals — the API has no aggregation endpoint."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total orders"
          value={ordersQ.data?.totalElements ?? 0}
          tone="blue"
          icon={<ShoppingBag className="h-5 w-5" />}
          hint="All-time count"
        />
        <StatCard
          label="Revenue (recent)"
          value={money(revenueRecent, CURRENCY)}
          tone="gold"
          icon={<DollarSign className="h-5 w-5" />}
          hint="Non-cancelled orders in the latest page"
        />
        <StatCard
          label="Pending orders"
          value={pendingCount}
          tone="rose"
          icon={<Clock className="h-5 w-5" />}
          hint="Awaiting processing (recent page)"
        />
        <StatCard
          label="Products"
          value={productsQ.data?.totalElements ?? 0}
          tone="violet"
          icon={<Package className="h-5 w-5" />}
          hint="All-time count"
        />
        <StatCard
          label="Low stock"
          value={lowStock}
          tone="rose"
          icon={<AlertTriangle className="h-5 w-5" />}
          hint="Stock ≤ 5 (recent page)"
        />
        {isAdmin && (
          <StatCard
            label="Users"
            value={usersQ.data?.totalElements ?? (usersQ.isLoading ? '…' : 0)}
            tone="green"
            icon={<Users className="h-5 w-5" />}
            hint="Total registered users"
          />
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Orders (recent)</h2>
            <span className="text-xs text-slate-500">Grouped by day, latest {orders.length} orders</span>
          </div>
          {chartData.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-500">No orders to chart yet.</div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e0b040" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#e0b040" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3140" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#2a3140" />
                  <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#2a3140" />
                  <Tooltip
                    contentStyle={{
                      background: '#141a26',
                      border: '1px solid #2a3140',
                      borderRadius: 12,
                      color: '#e2e8f0',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area type="monotone" dataKey="orders" stroke="#e0b040" strokeWidth={2} fill="url(#ordersFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Recent orders</h2>
            <Link to="/admin/orders" className="text-xs font-medium text-gold-400 hover:text-gold-300">
              View all
            </Link>
          </div>
          {recentOrders.length === 0 ? (
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
                      <p className="truncate font-mono text-xs text-slate-400">#{o.id.slice(0, 8)}</p>
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
    </div>
  );
}
