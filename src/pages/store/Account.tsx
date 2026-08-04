import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BadgeCheck, Heart, MapPin, Package, Settings, ShieldAlert } from 'lucide-react';
import { listOrders } from '@/api/orders';
import { money, formatDate, titleCase } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { Badge, LinkButton } from '@/components/ui';

const LINKS = [
  { to: '/orders', label: 'Orders', desc: 'Track and review past orders', icon: Package },
  { to: '/account/wishlist', label: 'Wishlist', desc: 'Pieces you saved for later', icon: Heart },
  { to: '/account/addresses', label: 'Addresses', desc: 'Saved delivery addresses', icon: MapPin },
  { to: '/account/settings', label: 'Settings', desc: 'Profile and password', icon: Settings },
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
    <div>
      <header className="border-b border-ink-700 pb-6">
        <h1 className="font-display text-h1 text-slate-100">Hello, {user?.fullName ?? 'there'}</h1>
        <p className="mt-2 text-body-sm text-slate-400">{user?.email}</p>
      </header>

      {/* Account state — badges only, no panel. This is one line of fact, and
          wrapping it in a card gives it more weight than it deserves. */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
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
        <LinkButton to="/account/settings" variant="outline" size="sm">
          Edit profile
        </LinkButton>
      </div>

      {/* Navigation — a hairline grid of destinations rather than four icon
          cards; the labels are the interface, the icons are only anchors. */}
      <nav className="mt-12 grid grid-cols-1 border-t border-ink-700 sm:grid-cols-2">
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="group flex items-center gap-4 border-b border-ink-700 py-6 transition-colors hover:bg-ink-850 sm:px-2"
          >
            <l.icon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm font-medium text-slate-100">{l.label}</span>
              <span className="block text-caption text-slate-500">{l.desc}</span>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        ))}
      </nav>

      {/* Recent orders */}
      <section className="mt-14">
        <div className="flex items-end justify-between gap-4 border-b border-ink-700 pb-5">
          <h2 className="font-display text-h2 text-slate-100">Recent orders</h2>
          <Link
            to="/orders"
            className="shrink-0 text-overline uppercase text-slate-500 transition-colors hover:text-slate-100"
          >
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="py-8 text-body-sm text-slate-500">No orders yet.</p>
        ) : (
          <div className="divide-y divide-ink-700 border-b border-ink-700">
            {recent.map((o) => (
              <Link
                key={o.id}
                to={`/orders/${o.id}`}
                className="flex flex-wrap items-center justify-between gap-3 py-5 transition-colors hover:bg-ink-850 sm:px-2"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-body-sm text-slate-100">#{o.id.slice(0, 8)}</span>
                  <OrderStatusBadge status={o.status} />
                  <span className="text-caption text-slate-500">{formatDate(o.createdAt)}</span>
                </div>
                <span className="text-body-sm font-semibold text-slate-100">
                  {money(o.totalAmount, o.currency)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
