import { useState } from 'react';
import { updateProfile, updatePassword } from '@/api/users';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button, Card, Field, Input, PasswordInput, PageHeader } from '@/components/ui';

export default function AccountSettings() {
  const { user, setUser } = useAuth();
  const toast = useToast();

  // Profile form
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileErrors({});
    if (!fullName.trim()) {
      setProfileErrors({ fullName: 'Name is required' });
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateProfile(fullName.trim());
      setUser(updated);
      toast.success('Profile updated');
    } catch (err) {
      if (err instanceof ApiError && err.hasFieldErrors()) {
        setProfileErrors(err.fieldErrorMap());
      } else {
        toast.error('Could not update profile', err instanceof Error ? err.message : 'Please try again.');
      }
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
      if (err instanceof ApiError && err.hasFieldErrors()) {
        setPasswordErrors(err.fieldErrorMap());
      } else {
        toast.error('Could not update password', err instanceof Error ? err.message : 'Please try again.');
      }
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Account settings" subtitle="Update your profile and password." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile */}
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Profile</h2>
          <form onSubmit={saveProfile} className="space-y-4">
            <Field label="Email">
              <Input value={user?.email ?? ''} disabled readOnly />
            </Field>
            <Field label="Full name" required error={profileErrors.fullName}>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} invalid={!!profileErrors.fullName} autoComplete="name" />
            </Field>
            <Button type="submit" loading={savingProfile}>
              Save profile
            </Button>
          </form>
        </Card>

        {/* Password */}
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Password</h2>
          <form onSubmit={savePassword} className="space-y-4">
            <Field label="Current password" required error={passwordErrors.currentPassword}>
              <PasswordInput
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                invalid={!!passwordErrors.currentPassword}
                autoComplete="current-password"
              />
            </Field>
            <Field
              label="New password"
              required
              error={passwordErrors.newPassword}
              hint="At least 8 characters, including a letter and a number."
            >
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                invalid={!!passwordErrors.newPassword}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password" required error={passwordErrors.confirmPassword}>
              <PasswordInput
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
        </Card>
      </div>
    </div>
  );
}
