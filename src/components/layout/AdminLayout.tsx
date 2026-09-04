import { useMemo, useState, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Boxes,
  CalendarClock,
  CalendarCog,
  ChevronDown,
  FolderTree,
  GalleryHorizontalEnd,
  LayoutDashboard,
  Tags,
  LogOut,
  Menu,
  MessagesSquare,
  PanelLeft,
  PanelLeftClose,
  QrCode,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UserRound,
  TicketPercent,
  Truck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getPublicStore } from '@/api/store';
import { titleCase } from '@/lib/format';
import { useConsoleFeatures, type StoreFeature } from '@/lib/features';
import { useLexicon, type LexiconKey } from '@/lib/lexicon';
import { useDarkTheme } from '@/lib/useDarkTheme';
import { BRAND_NAME } from '@/lib/brand';
import {
  Breadcrumbs,
  cn,
  Drawer,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Tooltip,
  Wordmark,
  type Crumb,
} from '@/components/ui';

interface NavItem {
  to: string;
  /** Lexicon key, not a word. See the note on NavGroup. */
  label: LexiconKey;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  end?: boolean;
}

interface NavGroup {
  label: LexiconKey;
  items: NavItem[];
  /**
   * The section this group belongs to — one grant per top-level group.
   *
   * Different from `adminOnly`, which is about who is looking: this is about
   * what the platform has granted this shop. A store without the grant gets a
   * console that never mentions the group at all — no heading, no empty
   * screens, and no links to endpoints that would answer 403.
   *
   * Every group has one. Nothing here is unconditional except Settings, which
   * is deliberately not in this list: a store must always be able to reach its
   * own settings, or withdrawing a section could leave a merchant unable to
   * configure their way back to anything.
   */
  feature: StoreFeature;
}

/*
 * Labels are LEXICON KEYS rather than words.
 *
 * Every console on the platform ships this same navigation; what a shop calls
 * the things in it is data. A bakery's staff open "Cakes", not "Inventory", and
 * a parlour's open "Appointments" rather than "Diary" — and they change that
 * themselves, in settings, without waiting for a release. A hardcoded string
 * here would need a developer to undo.
 */

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'nav.overview',
    feature: 'OVERVIEW',
    items: [{ to: '/admin', label: 'nav.dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'nav.catalog',
    feature: 'CATALOG',
    items: [
      { to: '/admin/inventory', label: 'nav.inventory', icon: Boxes },
      { to: '/admin/categories', label: 'nav.categories', icon: FolderTree },
      { to: '/admin/brands', label: 'nav.brands', icon: Tags },
      { to: '/admin/banners', label: 'nav.banners', icon: GalleryHorizontalEnd },
      { to: '/admin/reviews', label: 'nav.reviews', icon: MessagesSquare },
    ],
  },
  {
    label: 'nav.sales',
    feature: 'SALES',
    items: [
      { to: '/admin/orders', label: 'nav.orders', icon: ShoppingBag },
      { to: '/admin/deliverables', label: 'nav.deliverables', icon: Truck },
      { to: '/admin/coupons', label: 'nav.coupons', icon: TicketPercent },
    ],
  },
  {
    label: 'nav.bookings',
    feature: 'BOOKINGS',
    items: [
      { to: '/admin/bookings', label: 'nav.diary', icon: CalendarClock },
      { to: '/admin/services', label: 'nav.services', icon: Sparkles },
      { to: '/admin/service-categories', label: 'nav.serviceGroups', icon: FolderTree },
      { to: '/admin/staff', label: 'nav.team', icon: UserRound },
      { to: '/admin/service-reviews', label: 'nav.serviceReviews', icon: MessagesSquare },
      // The settings that govern the diary are the merchant's own, not counter
      // staff's: opening hours and how far ahead people may book.
      { to: '/admin/booking-settings', label: 'nav.bookingSetup', icon: CalendarCog, adminOnly: true },
    ],
  },
  {
    label: 'nav.people',
    feature: 'PEOPLE',
    items: [{ to: '/admin/users', label: 'nav.users', icon: Users, adminOnly: true }],
  },
  {
    label: 'nav.insights',
    feature: 'INSIGHTS',
    items: [{ to: '/admin/reports', label: 'nav.reports', icon: BarChart3 }],
  },
  {
    label: 'nav.system',
    feature: 'SYSTEM',
    items: [
      // Not adminOnly: the backend allows STAFF, and printing a poster for the
      // window is counter work rather than an owner's job.
      { to: '/admin/qr-code', label: 'nav.storeQr', icon: QrCode },
    ],
  },
];

/**
 * Settings, kept out of the grantable groups and pinned to the foot of the nav.
 *
 * It is the one console page no grant can take away. An operator who withdrew
 * System would otherwise leave the merchant with no way to reach payment
 * settings, opening copy, or the rename form that decides what every other
 * label in this sidebar says.
 */
const SETTINGS_ITEM: NavItem = {
  to: '/admin/settings',
  label: 'nav.settings',
  icon: Settings,
  adminOnly: true,
};

const COLLAPSE_KEY = 'rc-admin-sidebar-collapsed';

/**
 * Path segment to the lexicon key naming it, so a breadcrumb says what the nav
 * says. A trail reading Admin › Inventory while the sidebar says Cakes is the
 * kind of small inconsistency that makes software feel like someone else's.
 */
const CRUMB_KEYS: Record<string, LexiconKey> = {
  orders: 'nav.orders',
  deliverables: 'nav.deliverables',
  coupons: 'nav.coupons',
  inventory: 'nav.inventory',
  categories: 'nav.categories',
  brands: 'nav.brands',
  banners: 'nav.banners',
  reviews: 'nav.reviews',
  reports: 'nav.reports',
  users: 'nav.users',
  settings: 'nav.settings',
  'qr-code': 'nav.storeQr',
  bookings: 'nav.diary',
  services: 'nav.services',
  'service-categories': 'nav.serviceGroups',
  staff: 'nav.team',
  'service-reviews': 'nav.serviceReviews',
  'booking-settings': 'nav.bookingSetup',
};

function buildCrumbs(pathname: string, t: (key: LexiconKey) => string): Crumb[] {
  const parts = pathname.split('/').filter(Boolean); // e.g. ['admin','orders','12']
  const crumbs: Crumb[] = [];
  let acc = '';
  parts.forEach((seg, i) => {
    acc += `/${seg}`;
    const isLast = i === parts.length - 1;
    let label: string;
    if (i === 0) label = 'Admin';
    // Numeric ids, and UUIDs — a booking's id is a UUID, and thirty-six
    // characters of hex in a breadcrumb is noise rather than a reference.
    else if (/^\d+$/.test(seg)) label = `#${seg}`;
    else if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg)) label = `#${seg.slice(0, 8)}`;
    else if (seg === 'new') label = 'New';
    else {
      const key = CRUMB_KEYS[seg];
      label = key ? t(key) : titleCase(seg);
    }
    crumbs.push({ label, to: isLast ? undefined : acc });
  });
  // On the bare /admin route, surface it as the current dashboard page.
  if (crumbs.length === 1) return [{ label: t('nav.dashboard') }];
  return crumbs;
}

export default function AdminLayout() {
  // The console keeps the dark palette; the storefront is light. See useDarkTheme
  // for why the scope has to sit on <html> rather than on this wrapper.
  useDarkTheme();

  const { user, isAdmin, showsPlatformConsole, logout } = useAuth();
  const { has: hasFeature } = useConsoleFeatures();
  const { t } = useLexicon();
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
  const storeName = store?.name || BRAND_NAME;

  const crumbs = useMemo(() => buildCrumbs(location.pathname, t), [location.pathname, t]);

  // Groups this store has been granted, filtered to what this user may see
  // (empty groups dropped). The grant filter runs first: a section the platform
  // has not given this shop is never mentioned, rather than shown as a link to
  // screens the server would refuse.
  //
  // Settings is appended afterwards rather than living in NAV_GROUPS, because it
  // is the one page no grant governs — see SETTINGS_ITEM.
  const groups = useMemo(() => {
    const granted = NAV_GROUPS.filter((g) => hasFeature(g.feature))
      .map((g) => ({ ...g, items: g.items.filter((it) => !it.adminOnly || isAdmin) }))
      .filter((g) => g.items.length > 0);

    if (!isAdmin) return granted;

    // Joins the System group when the shop has one, so the sidebar does not grow
    // a heading with a single item in it for the sake of one link.
    const system = granted.find((g) => g.feature === 'SYSTEM');
    if (system) {
      return granted.map((g) => (g === system ? { ...g, items: [...g.items, SETTINGS_ITEM] } : g));
    }
    return [...granted, { label: 'nav.system' as LexiconKey, feature: 'SYSTEM' as StoreFeature, items: [SETTINGS_ITEM] }];
  }, [isAdmin, hasFeature]);

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
    // The storefront sign-in, which is where staff and administrators of this store come back in.
    // /admin/login is the platform operators' door and would leave them unable to sign in again.
    navigate('/login');
  }

  function renderNav({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
    return (
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            {compact ? (
              <div className="mx-2 my-2 border-t border-ink-800" aria-hidden />
            ) : (
              <p className="px-3 text-overline uppercase text-slate-500">{t(group.label)}</p>
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
                  {!compact && t(item.label)}
                </NavLink>
              );
              return compact ? (
                <Tooltip key={item.to} content={t(item.label)} side="right">
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
          {compact ? (
            <span className="font-display text-lg font-semibold text-slate-100" aria-hidden>
              A
            </span>
          ) : (
            <div className="min-w-0">
              <Wordmark name={storeName} size="sm" className="block truncate" />
              <p className="mt-1 text-[11px] uppercase tracking-wider text-gold-500">Admin Console</p>
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
              {/* The only way into the platform console. Shown solely to an
                  operator: for everyone else the route redirects anyway, and an
                  entry that always 403s is worse than no entry. */}
              {showsPlatformConsole && (
                <DropdownMenuItem asChild>
                  <Link to="/platform">
                    <ShieldCheck className="h-4 w-4" /> Platform console
                  </Link>
                </DropdownMenuItem>
              )}
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
