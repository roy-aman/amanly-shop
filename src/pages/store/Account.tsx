import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BadgeCheck,
  Heart,
  LayoutDashboard,
  MapPin,
  Package,
  ShieldAlert,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import { listOrders } from '@/api/orders';
import { updatePassword, updateProfile } from '@/api/users';
import { ApiError } from '@/lib/http';
import { money, formatDate, titleCase } from '@/lib/format';
import { PASSWORD_HINT } from '@/lib/passwordRules';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { Badge, Button, Field, Input, PasswordInput } from '@/components/ui';

const LINKS = [
  { to: '/orders', label: 'Orders', desc: 'Track and review past orders', icon: Package },
  { to: '/account/wishlist', label: 'Wishlist', desc: 'Pieces you saved for later', icon: Heart },
  { to: '/account/addresses', label: 'Addresses', desc: 'Saved delivery addresses', icon: MapPin },
];

/**
 * What this account may reach beyond shopping, mirroring the role model exactly: STAFF runs the
 * catalogue and orders, ADMIN adds people and store settings on top, and PLATFORM_ADMIN administers
 * the platform itself. Roles are cumulative, so an administrator sees the staff entry too.
 *
 * Hiding a link is presentation, never protection — every one of these routes is guarded again on
 * arrival, and the API refuses regardless of what the UI drew.
 */
function manageLinks({ isStaff, isAdmin, isPlatformAdmin }: { isStaff: boolean; isAdmin: boolean; isPlatformAdmin: boolean }) {
  const links: { to: string; label: string; desc: string; icon: typeof Package }[] = [];
  if (isStaff) {
    links.push({ to: '/admin', label: 'Admin console', desc: 'Products, orders, stock and reports', icon: LayoutDashboard });
  }
  if (isAdmin) {
    links.push({ to: '/admin/users', label: 'Team & users', desc: 'Add staff and change what they can do', icon: Users });
    links.push({ to: '/admin/settings', label: 'Store settings', desc: 'Payments, WhatsApp and delivery', icon: Store });
  }
  if (isPlatformAdmin) {
    links.push({ to: '/platform', label: 'Platform console', desc: 'Every store on the platform', icon: ShieldCheck });
  }
  return links;
}

export default function Account() {
  const { user, isStaff, isAdmin, isPlatformAdmin } = useAuth();
  const manage = manageLinks({ isStaff, isAdmin, isPlatformAdmin });

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

      {/* Name and password live here rather than on a separate settings page: they are the profile,
          and everyone who signs in has them — a shopper, a staff member and an administrator alike. */}
      <ProfileSection />

      {/* Staff and administrators shop here like anyone else, so their console lives alongside the
          customer links rather than behind a separate sign-in. Absent entirely for a shopper. */}
      {manage.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-h4 text-slate-100">Manage</h2>
          <p className="mt-1 text-body-sm text-slate-400">
            You have staff access at this store. These open the console for it.
          </p>
          <nav className="mt-4 grid grid-cols-1 border-t border-ink-700 sm:grid-cols-2">
            {manage.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="group flex items-center gap-4 border-b border-ink-700 py-6 transition-colors hover:bg-ink-850 sm:px-2"
              >
                <l.icon className="h-5 w-5 shrink-0 text-gold-400" aria-hidden />
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
        </section>
      )}

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

/**
 * Your details: display name and password.
 *
 * Role-independent by design — an administrator changes their own password in
 * exactly the same place a shopper does. The store-level settings a role gates
 * (payments, delivery, tax) are a different thing entirely and live in the admin
 * console under Settings.
 */
function ProfileSection() {
  const { user, setUser } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [savingPassword, setSavingPassword] = useState(false);

  const nameDirty = fullName.trim() !== (user?.fullName ?? '');

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileErrors({});
    if (!fullName.trim()) {
      setProfileErrors({ fullName: 'Name is required' });
      return;
    }
    setSavingProfile(true);
    try {
      // setUser keeps the header greeting and the account menu in step without a refetch.
      setUser(await updateProfile(fullName.trim()));
      toast.success('Profile updated');
    } catch (err) {
      if (err instanceof ApiError && err.hasFieldErrors()) setProfileErrors(err.fieldErrorMap());
      else toast.error('Could not update profile', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordErrors({});
    const next: Record<string, string> = {};
    if (!currentPassword) next.currentPassword = 'Current password is required';
    if (!newPassword) next.newPassword = 'New password is required';
    if (newPassword && confirmPassword !== newPassword) next.confirmPassword = 'Passwords do not match';
    if (Object.keys(next).length) {
      setPasswordErrors(next);
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(currentPassword, newPassword);
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof ApiError && err.hasFieldErrors()) setPasswordErrors(err.fieldErrorMap());
      else toast.error('Could not update password', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <section className="mt-14">
      <h2 className="font-display text-h2 text-slate-100">Your profile</h2>
      <p className="mt-1 text-body-sm text-slate-400">Your name and password. Your email cannot be changed.</p>

      <div className="mt-8 grid grid-cols-1 gap-12 border-t border-ink-700 pt-8 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="space-y-4">
          <h3 className="text-overline uppercase text-slate-500">Details</h3>
          <Field label="Email">
            <Input aria-label="Email" value={user?.email ?? ''} disabled readOnly />
          </Field>
          <Field label="Full name" required error={profileErrors.fullName}>
            <Input
              aria-label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              invalid={!!profileErrors.fullName}
              autoComplete="name"
            />
          </Field>
          <Button type="submit" loading={savingProfile} disabled={!nameDirty}>
            Save name
          </Button>
        </form>

        <form onSubmit={savePassword} className="space-y-4">
          <h3 className="text-overline uppercase text-slate-500">Password</h3>
          <Field label="Current password" required error={passwordErrors.currentPassword}>
            <PasswordInput
              aria-label="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              invalid={!!passwordErrors.currentPassword}
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" required error={passwordErrors.newPassword} hint={PASSWORD_HINT}>
            <PasswordInput
              aria-label="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              invalid={!!passwordErrors.newPassword}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" required error={passwordErrors.confirmPassword}>
            <PasswordInput
              aria-label="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              invalid={!!passwordErrors.confirmPassword}
              autoComplete="new-password"
            />
          </Field>
          <Button type="submit" loading={savingPassword}>
            Update password
          </Button>
        </form>
      </div>
    </section>
  );
}
