import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  Crown,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/components/ui';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, end: true },
  { to: '/admin/orders', label: 'Orders', icon: <ShoppingBag className="h-5 w-5" /> },
  { to: '/admin/deliverables', label: 'Deliverables', icon: <Truck className="h-5 w-5" /> },
  { to: '/admin/inventory', label: 'Inventory', icon: <Boxes className="h-5 w-5" /> },
  { to: '/admin/categories', label: 'Categories', icon: <FolderTree className="h-5 w-5" /> },
  { to: '/admin/reports', label: 'Reports', icon: <BarChart3 className="h-5 w-5" /> },
  { to: '/admin/users', label: 'Teams & Users', icon: <Users className="h-5 w-5" />, adminOnly: true },
  { to: '/admin/settings', label: 'Settings', icon: <Settings className="h-5 w-5" />, adminOnly: true },
];

export default function AdminLayout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-ink-800 px-5">
        <Crown className="h-6 w-6 text-gold-400" />
        <div>
          <p className="font-display text-sm font-bold leading-tight text-slate-100">Royal Commerce</p>
          <p className="text-[11px] uppercase tracking-wider text-gold-500">Admin Console</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                isActive ? 'bg-gold-400/10 text-gold-300' : 'text-slate-400 hover:bg-ink-800 hover:text-slate-100',
              )
            }
          >
            {n.icon}
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-ink-800 p-3">
        <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-ink-800 hover:text-slate-100">
          <Store className="h-5 w-5" />
          View storefront
        </Link>
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-ink-800 hover:text-slate-100">
          <LogOut className="h-5 w-5" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-ink-800 bg-ink-900/60 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-ink-800 bg-ink-900">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-ink-800 bg-ink-950/80 px-4 backdrop-blur-lg sm:px-6">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-300 hover:bg-ink-800 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden">
            <span className="font-display text-sm font-bold text-slate-100">Admin</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-200">{user?.fullName}</p>
              <p className="text-xs text-gold-400">{isAdmin ? 'Administrator' : 'Staff'}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400/15 text-sm font-semibold text-gold-300">
              {user?.fullName?.charAt(0).toUpperCase() ?? 'A'}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Close button for mobile drawer accessibility */}
      {open && (
        <button onClick={() => setOpen(false)} className="fixed right-4 top-4 z-[60] rounded-lg bg-ink-800 p-2 text-slate-200 lg:hidden" aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
