import { useMemo, useState, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Boxes,
  ChevronDown,
  Crown,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  PanelLeft,
  PanelLeftClose,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getPublicStore } from '@/api/store';
import { titleCase } from '@/lib/format';
import {
  Breadcrumbs,
  cn,
  Drawer,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Tooltip,
  type Crumb,
} from '@/components/ui';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  end?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    label: 'Catalog',
    items: [
      { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
      { to: '/admin/categories', label: 'Categories', icon: FolderTree },
      { to: '/admin/reviews', label: 'Reviews', icon: MessagesSquare },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
      { to: '/admin/deliverables', label: 'Deliverables', icon: Truck },
    ],
  },
  { label: 'People', items: [{ to: '/admin/users', label: 'Users', icon: Users, adminOnly: true }] },
  { label: 'Insights', items: [{ to: '/admin/reports', label: 'Reports', icon: BarChart3 }] },
  { label: 'System', items: [{ to: '/admin/settings', label: 'Settings', icon: Settings, adminOnly: true }] },
];

const COLLAPSE_KEY = 'rc-admin-sidebar-collapsed';

const CRUMB_LABELS: Record<string, string> = {
  orders: 'Orders',
  deliverables: 'Deliverables',
  inventory: 'Inventory',
  categories: 'Categories',
  reviews: 'Reviews',
  reports: 'Reports',
  users: 'Users',
  settings: 'Settings',
  new: 'New',
};

function buildCrumbs(pathname: string): Crumb[] {
  const parts = pathname.split('/').filter(Boolean); // e.g. ['admin','orders','12']
  const crumbs: Crumb[] = [];
  let acc = '';
  parts.forEach((seg, i) => {
    acc += `/${seg}`;
    const isLast = i === parts.length - 1;
    let label: string;
    if (i === 0) label = 'Admin';
    else if (/^\d+$/.test(seg)) label = `#${seg}`;
    else label = CRUMB_LABELS[seg] ?? titleCase(seg);
    crumbs.push({ label, to: isLast ? undefined : acc });
  });
  // On the bare /admin route, surface it as the current "Dashboard" page.
  if (crumbs.length === 1) return [{ label: 'Dashboard' }];
  return crumbs;
}

export default function AdminLayout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const { data: store } = useQuery({ queryKey: ['public-store'], queryFn: getPublicStore, staleTime: 5 * 60_000 });
  const storeName = store?.name || 'Royal Commerce';

  const crumbs = useMemo(() => buildCrumbs(location.pathname), [location.pathname]);

  // Groups the current user is allowed to see (empty groups dropped).
  const groups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => !it.adminOnly || isAdmin) })).filter(
        (g) => g.items.length > 0,
      ),
    [isAdmin],
  );

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore persistence failure */
      }
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  function renderNav({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
    return (
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            {compact ? (
              <div className="mx-2 my-2 border-t border-ink-800" aria-hidden />
            ) : (
              <p className="px-3 text-overline uppercase text-slate-500">{group.label}</p>
            )}
            {group.items.map((item) => {
              const link = (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                      compact && 'justify-center px-0',
                      isActive
                        ? 'bg-gold-400/10 text-gold-300'
                        : 'text-slate-400 hover:bg-ink-800 hover:text-slate-100',
                    )
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!compact && item.label}
                </NavLink>
              );
              return compact ? (
                <Tooltip key={item.to} content={item.label} side="right">
                  {link}
                </Tooltip>
              ) : (
                link
              );
            })}
          </div>
        ))}
      </nav>
    );
  }

  function renderSidebar({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
    return (
      <div className="flex h-full flex-col">
        <div className={cn('flex h-16 items-center gap-2 border-b border-ink-800', compact ? 'justify-center px-2' : 'px-5')}>
          <Crown className="h-6 w-6 shrink-0 text-gold-400" />
          {!compact && (
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold leading-tight text-slate-100">{storeName}</p>
              <p className="text-[11px] uppercase tracking-wider text-gold-500">Admin Console</p>
            </div>
          )}
        </div>

        {renderNav({ compact, onNavigate })}

        <div className="border-t border-ink-800 p-3">
          {compact ? (
            <Tooltip content="View storefront" side="right">
              <Link
                to="/"
                onClick={onNavigate}
                className="flex justify-center rounded-lg px-0 py-2 text-slate-400 transition hover:bg-ink-800 hover:text-slate-100"
                aria-label="View storefront"
              >
                <Store className="h-5 w-5" />
              </Link>
            </Tooltip>
          ) : (
            <Link
              to="/"
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-ink-800 hover:text-slate-100"
            >
              <Store className="h-5 w-5" />
              View storefront
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'relative hidden shrink-0 border-r border-ink-800 bg-ink-900/60 transition-[width] duration-200 lg:block',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {renderSidebar({ compact: collapsed })}
        <button
          onClick={toggleCollapsed}
          className="absolute -right-3 top-20 z-raised flex h-6 w-6 items-center justify-center rounded-full border border-ink-700 bg-ink-850 text-slate-300 shadow-lift transition hover:text-slate-100"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* Mobile sidebar drawer */}
      <Drawer open={mobileOpen} onOpenChange={setMobileOpen} side="left" title={`${storeName} · Admin`}>
        <div className="-mx-5 -my-4">
          {renderNav({ compact: false, onNavigate: () => setMobileOpen(false) })}
          <div className="border-t border-ink-800 p-3">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-ink-800 hover:text-slate-100"
            >
              <Store className="h-5 w-5" />
              View storefront
            </Link>
          </div>
        </div>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-header flex h-16 items-center gap-3 border-b border-ink-800 bg-ink-950/80 px-4 backdrop-blur-lg sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-300 transition hover:bg-ink-800 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <span className="font-display text-sm font-bold text-slate-100">{storeName}</span>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu
              align="end"
              trigger={
                <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-left transition hover:bg-ink-800" aria-label="User menu">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400/15 text-sm font-semibold text-gold-300">
                    {user?.fullName?.charAt(0).toUpperCase() ?? 'A'}
                  </span>
                  <span className="hidden text-right sm:block">
                    <span className="block text-sm font-medium text-slate-200">{user?.fullName}</span>
                    <span className="block text-xs text-gold-400">{isAdmin ? 'Administrator' : 'Staff'}</span>
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden />
                </button>
              }
            >
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/">
                  <Store className="h-4 w-4" /> View storefront
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={handleLogout}>
                <LogOut className="h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        </header>

        {/* Breadcrumbs slot — derived from the route; pages may refine later. */}
        <div className="border-b border-ink-800 bg-ink-950/40 px-4 py-2.5 sm:px-6 lg:px-8">
          <Breadcrumbs items={crumbs} />
        </div>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
