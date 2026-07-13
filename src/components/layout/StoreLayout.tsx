import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Crown, LogOut, Menu, Package, Search, Settings, ShoppingCart, User, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { cn } from '@/components/ui';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Shop', end: false },
];

export default function StoreLayout() {
  const { user, isAuthenticated, isStaff, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-gold-400" />
            <span className="font-display text-lg font-bold text-slate-100">Royal Commerce</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
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
          </nav>

          <div className="flex items-center gap-1.5">
            <Link to="/products" className="rounded-lg p-2 text-slate-300 hover:bg-ink-800 hover:text-slate-100" aria-label="Search">
              <Search className="h-5 w-5" />
            </Link>
            <Link to="/cart" className="relative rounded-lg p-2 text-slate-300 hover:bg-ink-800 hover:text-slate-100" aria-label="Cart">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-bold text-ink-950">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            {isAuthenticated ? (
              <div className="hidden items-center gap-1.5 md:flex">
                <NavLink to="/orders" className="rounded-lg p-2 text-slate-300 hover:bg-ink-800 hover:text-slate-100" aria-label="Orders">
                  <Package className="h-5 w-5" />
                </NavLink>
                <NavLink to="/account" className="rounded-lg p-2 text-slate-300 hover:bg-ink-800 hover:text-slate-100" aria-label="Account">
                  <User className="h-5 w-5" />
                </NavLink>
                {isStaff && (
                  <Link
                    to="/admin"
                    className="rounded-lg p-2 text-gold-400 hover:bg-ink-800"
                    aria-label="Admin console"
                    title="Admin console"
                  >
                    <Settings className="h-5 w-5" />
                  </Link>
                )}
                <button onClick={handleLogout} className="rounded-lg p-2 text-slate-300 hover:bg-ink-800 hover:text-slate-100" aria-label="Log out">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-200 hover:text-slate-100">
                  Sign in
                </Link>
                <Link to="/register" className="rounded-lg bg-gold-400 px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-gold-300">
                  Register
                </Link>
              </div>
            )}

            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-lg p-2 text-slate-300 hover:bg-ink-800 md:hidden"
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-ink-800 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-ink-800">
                  {n.label}
                </NavLink>
              ))}
              {isAuthenticated ? (
                <>
                  <NavLink to="/orders" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-ink-800">
                    My orders
                  </NavLink>
                  <NavLink to="/account" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-ink-800">
                    Account
                  </NavLink>
                  {isStaff && (
                    <Link to="/admin" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-gold-300 hover:bg-ink-800">
                      Admin console
                    </Link>
                  )}
                  <button onClick={handleLogout} className="rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-ink-800">
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-ink-800">
                    Sign in
                  </Link>
                  <Link to="/register" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-gold-300 hover:bg-ink-800">
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-ink-800 bg-ink-950/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-gold-500" />
            <span>Royal Commerce</span>
          </div>
          <p>© {new Date().getFullYear()} Royal Commerce. All rights reserved.</p>
          {user && <p className="text-xs">Signed in as {user.email}</p>}
        </div>
      </footer>
    </div>
  );
}
