import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  Heart,
  Instagram,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingBag,
  User,
  X,
  Youtube,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useToast } from '@/context/ToastContext';
import { getPublicStore } from '@/api/store';
import { getCategoryTree } from '@/api/catalog';
import { money } from '@/lib/format';
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import {
  cn,
  Drawer,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  EmptyState,
  LinkButton,
  Wordmark,
} from '@/components/ui';

/**
 * Primary nav. "New in" is a real query against the catalog's default sort
 * rather than a decorative label — every entry here resolves to a live route.
 */
const PRIMARY_NAV = [
  { to: '/products?sort=createdAt,desc', label: 'New in' },
  { to: '/products', label: 'Shop all' },
];

const SOCIALS = [
  { label: 'Instagram', icon: Instagram },
  { label: 'YouTube', icon: Youtube },
];

const PAYMENT_METHODS = ['Visa', 'Mastercard', 'UPI', 'Razorpay', 'Cash on delivery'];

export default function StoreLayout() {
  const { user, isAuthenticated, isStaff, logout } = useAuth();
  const { cart, itemCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Store name + category nav come from real public endpoints; both degrade to a
  // tasteful default / empty menu if the request fails, so the chrome never breaks.
  const { data: store } = useQuery({
    queryKey: ['public-store'],
    queryFn: getPublicStore,
    staleTime: 5 * 60_000,
  });
  const { data: tree } = useQuery({
    queryKey: ['category-tree'],
    queryFn: getCategoryTree,
    staleTime: 5 * 60_000,
  });
  const storeName = store?.name || BRAND_NAME;
  const categories = tree ?? [];

  // The header carries no border until the page moves; the hairline appearing
  // on scroll is what separates it from the content instead of a permanent rule.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Any navigation closes the transient surfaces. Without this, following a
  // link out of the mega-menu leaves it hanging open over the new page.
  useEffect(() => {
    setCollectionsOpen(false);
    setSearchOpen(false);
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!searchOpen && !collectionsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setSearchOpen(false);
      setCollectionsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, collectionsOpen]);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  function runSearch(value: string) {
    const q = value.trim();
    if (!q) return;
    setSearchOpen(false);
    setMobileOpen(false);
    // Replace (rather than push) while already browsing the catalog so refining
    // a query doesn't spam the history stack.
    navigate(`/products?search=${encodeURIComponent(q)}`, { replace: location.pathname === '/products' });
  }

  function submitNewsletter(e: React.FormEvent) {
    e.preventDefault();
    // Newsletter capture ships in WP-6.4; no endpoint exists yet.
    toast.info('Coming soon', 'Newsletter sign-up will be available shortly.');
  }

  const iconButton =
    'relative flex h-11 w-11 items-center justify-center rounded-full text-slate-200 transition hover:bg-ink-800 hover:text-slate-100';

  return (
    <div className="flex min-h-full flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-tooltip focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-fg"
      >
        Skip to content
      </a>

      {/* ── Announcement ────────────────────────────────────────────────
          A brand line, not a promotion. The public store endpoint exposes no
          shipping threshold, and inventing "Free delivery over ₹X" would be
          stating a number the backend cannot back up. */}
      <p className="bg-primary px-4 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-primary-fg">
        {BRAND_TAGLINE}
      </p>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className={cn(
          'sticky top-0 z-header border-b bg-ink-950/90 backdrop-blur-lg transition-colors duration-300',
          scrolled ? 'border-ink-700' : 'border-transparent',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className={cn(iconButton, '-ml-2 md:hidden')}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/" className="shrink-0 md:pr-6" aria-label={`${storeName} home`}>
            <Wordmark name={storeName} size="lg" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {PRIMARY_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-body-sm transition-colors',
                    isActive ? 'text-slate-100' : 'text-slate-400 hover:text-slate-100',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}

            {categories.length > 0 && (
              <button
                onClick={() => setCollectionsOpen((o) => !o)}
                aria-expanded={collectionsOpen}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-3 py-2 text-body-sm transition-colors',
                  collectionsOpen ? 'text-slate-100' : 'text-slate-400 hover:text-slate-100',
                )}
              >
                Collections
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform duration-200', collectionsOpen && 'rotate-180')}
                  aria-hidden
                />
              </button>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={() => setSearchOpen(true)} className={iconButton} aria-label="Search">
              <Search className="h-5 w-5" />
            </button>

            {isAuthenticated && (
              <Link to="/account/wishlist" className={cn(iconButton, 'hidden sm:flex')} aria-label="Wishlist">
                <Heart className="h-5 w-5" />
                {wishlistCount > 0 && <CountDot value={wishlistCount} />}
              </Link>
            )}

            <button
              onClick={() => setCartOpen(true)}
              className={iconButton}
              aria-label={`Bag${itemCount > 0 ? `, ${itemCount} items` : ', empty'}`}
            >
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 && <CountDot value={itemCount} />}
            </button>

            <AccountMenu
              isAuthenticated={isAuthenticated}
              isStaff={isStaff}
              userLabel={user?.fullName || user?.email}
              wishlistCount={wishlistCount}
              onLogout={handleLogout}
              className={iconButton}
            />
          </div>
        </div>

        {/* ── Collections mega-menu ─────────────────────────────────────
            A panel rather than a dropdown list: categories are a browsing
            surface, and a single-column menu makes a catalog feel like a
            filing cabinet. */}
        {collectionsOpen && categories.length > 0 && (
          <div
            className="absolute inset-x-0 top-full hidden border-b border-ink-700 bg-ink-950 shadow-card md:block animate-fade-in"
            onMouseLeave={() => setCollectionsOpen(false)}
          >
            <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
              <div className="grid grid-cols-2 gap-x-8 gap-y-9 lg:grid-cols-4">
                {categories.map((root) => (
                  <div key={root.id}>
                    <Link
                      to={`/products?categoryId=${root.id}`}
                      className="text-overline uppercase text-slate-500 transition-colors hover:text-slate-100"
                    >
                      {root.name}
                    </Link>
                    {root.children?.length > 0 && (
                      <ul className="mt-4 space-y-2.5">
                        {root.children.map((child) => (
                          <li key={child.id}>
                            <Link
                              to={`/products?categoryId=${child.id}`}
                              className="text-body-sm text-slate-300 transition-colors hover:text-slate-100"
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-10 border-t border-ink-700 pt-5">
                <Link
                  to="/products"
                  className="text-body-sm font-medium text-slate-100 underline decoration-brand decoration-2 underline-offset-[6px]"
                >
                  View everything
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} onSearch={runSearch} />}

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 focus:outline-none sm:px-6 lg:px-8">
        <Outlet />
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="mt-20 border-t border-ink-700">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Wordmark name={storeName} size="xl" />
              <p className="mt-4 max-w-sm text-body text-slate-400">
                {BRAND_TAGLINE} {BRAND_DESCRIPTION} Chosen for fit, fabric, and how they wear over time.
              </p>

              <form onSubmit={submitNewsletter} className="mt-8 max-w-sm">
                <label htmlFor="newsletter-email" className="text-overline uppercase text-slate-500">
                  Join the list
                </label>
                <div className="mt-3 flex items-center gap-3 border-b border-ink-600 pb-2 focus-within:border-slate-100">
                  <input
                    id="newsletter-email"
                    type="email"
                    placeholder="Email address"
                    aria-label="Email address"
                    className="w-full bg-transparent text-body-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="shrink-0 text-overline uppercase text-slate-100 transition-colors hover:text-slate-400"
                  >
                    Subscribe
                  </button>
                </div>
                <p className="mt-2.5 text-caption text-slate-500">
                  Sign-up isn&apos;t live yet — nothing is stored.
                </p>
              </form>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7">
              <FooterColumn
                title="Shop"
                links={[
                  { label: 'New in', to: '/products?sort=createdAt,desc' },
                  { label: 'All products', to: '/products' },
                  { label: 'Your bag', to: '/cart' },
                ]}
              />
              <FooterColumn
                title="Account"
                links={
                  isAuthenticated
                    ? [
                        { label: 'My account', to: '/account' },
                        { label: 'Orders', to: '/orders' },
                        { label: 'Wishlist', to: '/account/wishlist' },
                        { label: 'Addresses', to: '/account/addresses' },
                      ]
                    : [
                        { label: 'Sign in', to: '/login' },
                        { label: 'Create account', to: '/register' },
                      ]
                }
              />
              {/* Policy pages do not exist yet — WP-7.6 owns them. Labelled as
                  pending rather than linked to "#", which reads as broken. */}
              <FooterColumn
                title="Help"
                links={[
                  { label: 'Shipping & returns', pending: true },
                  { label: 'Privacy policy', pending: true },
                  { label: 'Terms of service', pending: true },
                  { label: 'Contact', pending: true },
                ]}
              />
            </div>
          </div>

          <div className="mt-16 flex flex-col gap-6 border-t border-ink-700 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption text-slate-500">
              © {new Date().getFullYear()} {storeName}
            </p>

            <div className="flex items-center gap-1">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-ink-800 hover:text-slate-100"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>

            <p className="text-caption text-slate-500">{PAYMENT_METHODS.join(' · ')}</p>
          </div>
        </div>
      </footer>

      {/* ── Mobile nav drawer ──────────────────────────────────────────── */}
      <Drawer open={mobileOpen} onOpenChange={setMobileOpen} side="left" title={storeName}>
        <div className="space-y-8">
          <nav className="flex flex-col" aria-label="Mobile">
            {PRIMARY_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end
                onClick={() => setMobileOpen(false)}
                className="border-b border-ink-700 py-4 text-h4 text-slate-100"
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          {categories.length > 0 && (
            <div>
              <p className="text-overline uppercase text-slate-500">Collections</p>
              <div className="mt-3 flex flex-col">
                {categories.map((root) => (
                  <Link
                    key={root.id}
                    to={`/products?categoryId=${root.id}`}
                    onClick={() => setMobileOpen(false)}
                    className="border-b border-ink-700 py-3.5 text-body text-slate-300"
                  >
                    {root.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div>
            {isAuthenticated ? (
              <div className="flex flex-col">
                {[
                  { to: '/account', label: 'Account' },
                  { to: '/orders', label: 'Orders' },
                  {
                    to: '/account/wishlist',
                    label: `Wishlist${wishlistCount > 0 ? ` (${wishlistCount})` : ''}`,
                  },
                  ...(isStaff ? [{ to: '/admin', label: 'Admin console' }] : []),
                ].map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setMobileOpen(false)}
                    className="border-b border-ink-700 py-3.5 text-body-sm text-slate-300"
                  >
                    {l.label}
                  </Link>
                ))}
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    void handleLogout();
                  }}
                  className="py-3.5 text-left text-body-sm text-slate-300"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3" onClick={() => setMobileOpen(false)}>
                <LinkButton to="/login" fullWidth size="lg">
                  Sign in
                </LinkButton>
                <LinkButton to="/register" variant="outline" fullWidth size="lg">
                  Create account
                </LinkButton>
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {/* ── Slide-out bag ──────────────────────────────────────────────── */}
      <Drawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        side="right"
        title="Your bag"
        footer={
          cart && cart.items.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-slate-400">Subtotal</span>
                <span className="text-h4 text-slate-100">{money(cart.totalAmount, cart.currency)}</span>
              </div>
              <p className="text-caption text-slate-500">Shipping and taxes are calculated at checkout.</p>
              <div className="grid gap-2" onClick={() => setCartOpen(false)}>
                <LinkButton to="/checkout" size="lg" fullWidth>
                  Checkout
                </LinkButton>
                <LinkButton to="/cart" variant="ghost" fullWidth>
                  View bag
                </LinkButton>
              </div>
            </div>
          ) : undefined
        }
      >
        {cart && cart.items.length > 0 ? (
          <ul className="divide-y divide-ink-700">
            {cart.items.map((item) => (
              <li key={item.cartItemId} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <Link
                    to={`/products/${item.productSlug}`}
                    onClick={() => setCartOpen(false)}
                    className="block truncate text-body-sm font-medium text-slate-100"
                  >
                    {item.productName}
                  </Link>
                  {item.variantOptionsLabel && (
                    <p className="mt-0.5 truncate text-caption text-slate-400">{item.variantOptionsLabel}</p>
                  )}
                  <p className="mt-1 text-caption text-slate-500">
                    {item.quantity} × {money(item.unitPrice, cart.currency)}
                  </p>
                </div>
                <span className="shrink-0 text-body-sm text-slate-100">
                  {money(item.subtotal, cart.currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Your bag is empty"
            message={isAuthenticated ? 'Everything you add will show up here.' : 'Sign in to start shopping.'}
            action={
              <span onClick={() => setCartOpen(false)}>
                <LinkButton to={isAuthenticated ? '/products' : '/login'}>
                  {isAuthenticated ? 'Start shopping' : 'Sign in'}
                </LinkButton>
              </span>
            }
          />
        )}
      </Drawer>
    </div>
  );
}

/** Count indicator on the bag/wishlist icons. */
function CountDot({ value }: { value: number }) {
  return (
    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-fg">
      {value > 99 ? '99+' : value}
    </span>
  );
}

/**
 * Full-width search panel. The header shows only an icon: a permanently-open
 * search field costs ~256px of the bar and makes the chrome look like an admin
 * tool. Opening a dedicated surface also gives the query room to breathe.
 */
function SearchOverlay({ onClose, onSearch }: { onClose: () => void; onSearch: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-modal flex flex-col bg-ink-950 animate-fade-in">
      <div className="mx-auto w-full max-w-3xl px-6 pt-24">
        <div className="flex items-center justify-between">
          <p className="text-overline uppercase text-slate-500">Search</p>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition hover:bg-ink-800 hover:text-slate-100"
            aria-label="Close search"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(value);
          }}
          className="mt-6 flex items-center gap-4 border-b-2 border-ink-600 pb-4 focus-within:border-slate-100"
        >
          <Search className="h-6 w-6 shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="What are you looking for?"
            aria-label="Search products"
            className="w-full bg-transparent text-h2 text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </form>
        <p className="mt-4 text-caption text-slate-500">Press Enter to search · Esc to close</p>
      </div>
    </div>
  );
}

function AccountMenu({
  isAuthenticated,
  isStaff,
  userLabel,
  wishlistCount,
  onLogout,
  className,
}: {
  isAuthenticated: boolean;
  isStaff: boolean;
  userLabel?: string;
  wishlistCount: number;
  onLogout: () => void;
  className: string;
}) {
  return (
    <DropdownMenu
      align="end"
      trigger={
        <button className={className} aria-label="Account menu">
          <User className="h-5 w-5" />
        </button>
      }
    >
      {isAuthenticated ? (
        <>
          <DropdownMenuLabel>{userLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/account">
              <User className="h-4 w-4" /> Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/orders">
              <Package className="h-4 w-4" /> Orders
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/wishlist">
              <Heart className="h-4 w-4" /> Wishlist
              {wishlistCount > 0 && (
                <span className="ml-auto text-caption text-slate-500">{wishlistCount}</span>
              )}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/settings">
              <Settings className="h-4 w-4" /> Settings
            </Link>
          </DropdownMenuItem>
          {isStaff && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/admin">
                  <Settings className="h-4 w-4" /> Admin console
                </Link>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={onLogout}>
            <LogOut className="h-4 w-4" /> Log out
          </DropdownMenuItem>
        </>
      ) : (
        <>
          <DropdownMenuItem asChild>
            <Link to="/login">
              <User className="h-4 w-4" /> Sign in
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/register">Create an account</Link>
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenu>
  );
}

interface FooterLink {
  label: string;
  to?: string;
  /** Page not built yet (WP-7.6): rendered as plain text, not a dead link. */
  pending?: boolean;
}

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <p className="text-overline uppercase text-slate-500">{title}</p>
      <ul className="mt-4 space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            {l.to ? (
              <Link to={l.to} className="text-body-sm text-slate-400 transition-colors hover:text-slate-100">
                {l.label}
              </Link>
            ) : (
              <span className="text-body-sm text-slate-500" title="Coming soon">
                {l.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
