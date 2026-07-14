import { Fragment, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  CreditCard,
  Crown,
  Facebook,
  Instagram,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Twitter,
  User,
  Youtube,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { getPublicStore } from '@/api/store';
import { getCategoryTree } from '@/api/catalog';
import { money } from '@/lib/format';
import {
  cn,
  Drawer,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  EmptyState,
  LinkButton,
  SearchInput,
} from '@/components/ui';

const PRIMARY_NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Shop', end: false },
];

const SOCIALS = [
  { label: 'Facebook', icon: Facebook },
  { label: 'Instagram', icon: Instagram },
  { label: 'Twitter', icon: Twitter },
  { label: 'YouTube', icon: Youtube },
];

const PAYMENT_BADGES = ['Visa', 'Mastercard', 'UPI', 'Razorpay', 'COD'];

export default function StoreLayout() {
  const { user, isAuthenticated, isStaff, logout } = useAuth();
  const { cart, itemCount } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

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
  const storeName = store?.name || 'Royal Commerce';
  const categories = tree ?? [];

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  function runSearch(value: string) {
    const q = value.trim();
    if (!q) return;
    setMobileOpen(false);
    // The header search debounces per keystroke; replace (rather than push) while
    // already browsing the catalog so refining a query doesn't spam the history stack.
    navigate(`/products?search=${encodeURIComponent(q)}`, { replace: location.pathname === '/products' });
  }

  function submitNewsletter(e: React.FormEvent) {
    e.preventDefault();
    // Newsletter capture ships in WP-6.4; no endpoint exists yet.
    toast.info('Coming soon', 'Newsletter sign-up will be available shortly.');
  }

  const accountMenu = (
    <DropdownMenu
      align="end"
      trigger={
        <button
          className="flex items-center gap-1 rounded-lg p-2 text-slate-300 transition hover:bg-ink-800 hover:text-slate-100"
          aria-label="Account menu"
        >
          <User className="h-5 w-5" />
          <ChevronDown className="hidden h-4 w-4 sm:block" aria-hidden />
        </button>
      }
    >
      {isAuthenticated ? (
        <>
          <DropdownMenuLabel>{user?.fullName || user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/account">
              <User className="h-4 w-4" /> Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/orders">
              <Package className="h-4 w-4" /> My orders
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
                <Link to="/admin" className="text-gold-300">
                  <Settings className="h-4 w-4" /> Admin console
                </Link>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={handleLogout}>
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
            <Link to="/register" className="text-gold-300">
              Create an account
            </Link>
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenu>
  );

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-header border-b border-ink-800 bg-ink-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-300 transition hover:bg-ink-800 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/" className="flex shrink-0 items-center gap-2">
            <Crown className="h-6 w-6 text-gold-400" />
            <span className="font-display text-lg font-bold text-slate-100">{storeName}</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {PRIMARY_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'text-gold-300' : 'text-slate-300 hover:text-slate-100',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}

            {categories.length > 0 && (
              <DropdownMenu
                align="start"
                trigger={
                  <button className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-slate-100">
                    Categories
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </button>
                }
              >
                <DropdownMenuItem asChild>
                  <Link to="/products">All products</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {categories.map((root) => (
                  <Fragment key={root.id}>
                    <DropdownMenuItem asChild>
                      <Link to={`/products?categoryId=${root.id}`} className="font-semibold text-slate-100">
                        {root.name}
                      </Link>
                    </DropdownMenuItem>
                    {root.children?.map((child) => (
                      <DropdownMenuItem key={child.id} asChild>
                        <Link to={`/products?categoryId=${child.id}`} className="pl-6 text-slate-400">
                          {child.name}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </Fragment>
                ))}
              </DropdownMenu>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <SearchInput
              className="hidden w-64 lg:block"
              placeholder="Search products…"
              onSearch={runSearch}
              aria-label="Search products"
            />
            <Link
              to="/products"
              className="rounded-lg p-2 text-slate-300 transition hover:bg-ink-800 hover:text-slate-100 lg:hidden"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Link>

            <button
              onClick={() => setCartOpen(true)}
              className="relative rounded-lg p-2 text-slate-300 transition hover:bg-ink-800 hover:text-slate-100"
              aria-label={`Cart${itemCount > 0 ? `, ${itemCount} items` : ''}`}
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-bold text-ink-950">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </button>

            {accountMenu}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-ink-800 bg-ink-950/60">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Link to="/" className="flex items-center gap-2">
                <Crown className="h-6 w-6 text-gold-400" />
                <span className="font-display text-lg font-bold text-slate-100">{storeName}</span>
              </Link>
              <p className="mt-3 max-w-sm text-body-sm text-slate-400">
                A modern storefront for global customers. Curated products, secure checkout, and fast support.
              </p>

              <form onSubmit={submitNewsletter} className="mt-5 max-w-sm">
                <label htmlFor="newsletter-email" className="text-overline uppercase text-slate-500">
                  Stay in the loop
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="newsletter-email"
                    type="email"
                    placeholder="you@example.com"
                    className="rc-input flex-1"
                    aria-label="Email address"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-gold-400 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-gold-300"
                  >
                    Subscribe
                  </button>
                </div>
                <p className="mt-1.5 text-caption text-slate-500">Sign-up coming soon — no email is stored yet.</p>
              </form>
            </div>

            <FooterColumn
              title="Shop"
              links={[
                { label: 'All products', to: '/products' },
                { label: 'Cart', to: '/cart' },
                { label: 'Checkout', to: '/checkout' },
              ]}
            />
            <FooterColumn
              title="Account"
              links={
                isAuthenticated
                  ? [
                      { label: 'My account', to: '/account' },
                      { label: 'Orders', to: '/orders' },
                      { label: 'Addresses', to: '/account/addresses' },
                      { label: 'Settings', to: '/account/settings' },
                    ]
                  : [
                      { label: 'Sign in', to: '/login' },
                      { label: 'Register', to: '/register' },
                    ]
              }
            />
            <FooterColumn
              title="Policies"
              // Policy pages do not exist yet — placeholders until WP-7.6 (legal pages).
              links={[
                { label: 'Privacy policy', href: '#' },
                { label: 'Terms of service', href: '#' },
                { label: 'Shipping & returns', href: '#' },
                { label: 'Contact', href: '#' },
              ]}
            />
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-ink-800 pt-6 sm:flex-row">
            <p className="text-caption text-slate-500">
              © {new Date().getFullYear()} {storeName}. All rights reserved.
            </p>

            <div className="flex items-center gap-1">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-ink-800 hover:text-slate-100"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-slate-500" aria-hidden />
              {PAYMENT_BADGES.map((p) => (
                <span
                  key={p}
                  className="rounded border border-ink-700 bg-ink-900 px-2 py-0.5 text-[11px] font-medium text-slate-400"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── Mobile nav drawer ──────────────────────────────────────────── */}
      <Drawer open={mobileOpen} onOpenChange={setMobileOpen} side="left" title={storeName}>
        <div className="space-y-5">
          <SearchInput placeholder="Search products…" onSearch={runSearch} aria-label="Search products" />

          <nav className="flex flex-col gap-1">
            {PRIMARY_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-gold-400/10 text-gold-300' : 'text-slate-200 hover:bg-ink-800',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          {categories.length > 0 && (
            <div>
              <p className="px-3 text-overline uppercase text-slate-500">Categories</p>
              <div className="mt-1 flex flex-col gap-1">
                {categories.map((root) => (
                  <Link
                    key={root.id}
                    to={`/products?categoryId=${root.id}`}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-ink-800"
                  >
                    {root.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-ink-800 pt-4">
            {isAuthenticated ? (
              <div className="flex flex-col gap-1">
                <Link to="/account" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-ink-800">
                  Account
                </Link>
                <Link to="/orders" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-ink-800">
                  My orders
                </Link>
                {isStaff && (
                  <Link to="/admin" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm text-gold-300 hover:bg-ink-800">
                    Admin console
                  </Link>
                )}
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    void handleLogout();
                  }}
                  className="rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-ink-800"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2" onClick={() => setMobileOpen(false)}>
                <LinkButton to="/login" variant="secondary" fullWidth>
                  Sign in
                </LinkButton>
                <LinkButton to="/register" fullWidth>
                  Create account
                </LinkButton>
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {/* ── Slide-out mini-cart ────────────────────────────────────────── */}
      <Drawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        side="right"
        title="Your cart"
        footer={
          cart && cart.items.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Subtotal</span>
                <span className="font-semibold text-slate-100">{money(cart.totalAmount, cart.currency)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2" onClick={() => setCartOpen(false)}>
                <LinkButton to="/cart" variant="secondary">
                  View cart
                </LinkButton>
                <LinkButton to="/checkout">Checkout</LinkButton>
              </div>
            </div>
          ) : undefined
        }
      >
        {cart && cart.items.length > 0 ? (
          <ul className="divide-y divide-ink-800">
            {cart.items.map((item) => (
              <li key={item.cartItemId} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    to={`/products/${item.productSlug}`}
                    onClick={() => setCartOpen(false)}
                    className="block truncate text-sm font-medium text-slate-100 hover:text-gold-300"
                  >
                    {item.productName}
                  </Link>
                  <p className="mt-0.5 text-caption text-slate-500">
                    {item.quantity} × {money(item.unitPrice, cart.currency)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-slate-200">
                  {money(item.subtotal, cart.currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<ShoppingCart className="h-6 w-6" />}
            title="Your cart is empty"
            message={isAuthenticated ? 'Browse the catalog to add items.' : 'Sign in to start shopping.'}
            action={
              <span onClick={() => setCartOpen(false)}>
                <LinkButton to={isAuthenticated ? '/products' : '/login'}>
                  {isAuthenticated ? 'Browse products' : 'Sign in'}
                </LinkButton>
              </span>
            }
          />
        )}
      </Drawer>
    </div>
  );
}

interface FooterLink {
  label: string;
  to?: string;
  href?: string;
}

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <p className="text-overline uppercase text-slate-500">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            {l.to ? (
              <Link to={l.to} className="text-body-sm text-slate-400 transition hover:text-slate-100">
                {l.label}
              </Link>
            ) : (
              <a href={l.href} className="text-body-sm text-slate-400 transition hover:text-slate-100">
                {l.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
