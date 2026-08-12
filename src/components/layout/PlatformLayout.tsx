import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AlertTriangle, Building2, ChevronDown, LogOut, ShieldCheck, Store, UserCog } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useDarkTheme } from '@/lib/useDarkTheme';
import { AmanlyMark } from '@/components/ui/AmanlyMark';
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, cn } from '@/components/ui';

const NAV = [
  { to: '/platform', label: 'Stores', icon: Building2, end: true },
  { to: '/platform/operators', label: 'Operators', icon: UserCog, end: false },
  { to: '/platform/errors', label: 'Errors', icon: AlertTriangle, end: false },
];

/**
 * Shell for the platform-operator console.
 *
 * Deliberately a different *shape* from the store admin — a top rail rather
 * than a sidebar, over a gold identity strip — because an operator is signed in
 * "at" some merchant's store and everything else on screen belongs to that
 * merchant. Confusing the two surfaces means editing the wrong business, so the
 * distinction is structural rather than a change of accent colour.
 */
export default function PlatformLayout() {
  useDarkTheme();

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Identity strip. Always visible, never scrolls away: it is the answer to
          "whose data am I looking at" for someone who can edit every merchant. */}
      <div className="flex items-center justify-center gap-2 bg-brand px-4 py-1.5 text-caption font-semibold uppercase tracking-[0.14em] text-[#111111]">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Platform console · every store on the platform
      </div>

      <header className="sticky top-0 z-header border-b border-ink-800 bg-ink-950/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/platform" className="flex items-center gap-2.5" aria-label="Platform console home">
            <AmanlyMark className="h-7 w-7" />
            <span className="hidden font-display text-sm font-semibold uppercase tracking-[0.18em] text-slate-100 sm:block">
              Platform
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-gold-400/10 text-gold-300' : 'text-slate-400 hover:bg-ink-800 hover:text-slate-100',
                  )
                }
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto">
            <DropdownMenu
              align="end"
              trigger={
                <button
                  className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-left transition hover:bg-ink-800"
                  aria-label="Operator menu"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400/15 text-sm font-semibold text-gold-300">
                    {user?.fullName?.charAt(0).toUpperCase() ?? 'P'}
                  </span>
                  <span className="hidden text-right sm:block">
                    <span className="block text-sm font-medium text-slate-200">{user?.fullName}</span>
                    <span className="block text-xs text-gold-400">Platform operator</span>
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden />
                </button>
              }
            >
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/admin">
                  <Store className="h-4 w-4" /> This store&apos;s admin
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout}>
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
