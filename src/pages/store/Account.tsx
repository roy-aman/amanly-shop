import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Heart, MapPin, Package, Settings, ShieldAlert } from 'lucide-react';
import { listOrders } from '@/api/orders';
import { money, formatDate, titleCase } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { Badge, Card, LinkButton, PageHeader } from '@/components/ui';

const LINKS = [
  { to: '/account/wishlist', label: 'Wishlist', desc: 'Products you saved for later', icon: Heart },
  { to: '/account/addresses', label: 'Addresses', desc: 'Manage saved shipping addresses', icon: MapPin },
  { to: '/account/settings', label: 'Settings', desc: 'Profile & password', icon: Settings },
  { to: '/orders', label: 'Orders', desc: 'View your order history', icon: Package },
];

export default function Account() {
  const { user } = useAuth();

  const ordersQuery = useQuery({
    queryKey: ['orders', 'recent'],
    queryFn: () => listOrders({ size: 3, sort: 'createdAt,desc' }),
  });

  const recent = ordersQuery.data?.content ?? [];
  const verified = !!user?.emailVerifiedAt;

  return (
    <div className="space-y-6">
      <PageHeader title={`Hello, ${user?.fullName ?? 'there'}`} subtitle="Manage your account and orders." />

      {/* Overview */}
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">Signed in as</p>
          <p className="font-medium text-slate-100">{user?.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {verified ? (
              <Badge tone="green">
                <BadgeCheck className="h-3.5 w-3.5" /> Email verified
              </Badge>
            ) : (
              <Badge tone="amber">
                <ShieldAlert className="h-3.5 w-3.5" /> Email not verified
              </Badge>
            )}
            {user && <Badge tone="gray">{titleCase(user.provider)} account</Badge>}
          </div>
        </div>
        <LinkButton to="/account/settings" variant="outline">
          Edit profile
        </LinkButton>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to}>
            <Card className="flex h-full items-start gap-3 p-5 transition hover:border-ink-600">
              <div className="rounded-lg bg-gold-400/10 p-2 text-gold-400">
                <l.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-100">{l.label}</p>
                <p className="text-xs text-slate-500">{l.desc}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Recent orders</h2>
          <Link to="/orders" className="text-sm font-medium text-gold-300 hover:text-gold-200">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <Card className="p-5 text-sm text-slate-500">No orders yet.</Card>
        ) : (
          <div className="space-y-3">
            {recent.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="block">
                <Card className="flex items-center justify-between gap-3 p-4 transition hover:border-ink-600">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-slate-200">#{o.id.slice(0, 8)}</span>
                    <OrderStatusBadge status={o.status} />
                    <span className="text-xs text-slate-500">{formatDate(o.createdAt)}</span>
                  </div>
                  <span className="text-sm font-bold text-gold-300">{money(o.totalAmount, o.currency)}</span>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
