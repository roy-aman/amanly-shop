import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { resetPassword } from '@/api/auth';
import { ApiError } from '@/lib/http';
import { useToast } from '@/context/ToastContext';
import { Button, Field, Input, LinkButton, PasswordInput } from '@/components/ui';
import AuthLayout from '@/components/layout/AuthLayout';

const PASSWORD_HINT = 'At least 12 characters with uppercase, lowercase, a digit and a special character.';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const toast = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthLayout title="Invalid reset link" subtitle="This password reset link is missing or malformed.">
        <p className="mb-5 text-center text-sm text-slate-400">
          Please request a new link to reset your password.
        </p>
        <LinkButton to="/forgot-password" fullWidth>
          Request a new link
        </LinkButton>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password updated" subtitle="Your password has been changed successfully.">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="text-sm text-slate-300">You can now sign in with your new password.</p>
        </div>
        <LinkButton to="/login" fullWidth>
          Continue to sign in
        </LinkButton>
      </AuthLayout>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token!, newPassword);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrorMap());
        if (!err.hasFieldErrors()) {
          toast.error('Reset failed', err.message);
        }
      } else {
        toast.error('Unexpected error', String(err));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Choose a new password for your account"
      footer={
        <Link to="/login" className="font-medium text-gold-400 hover:text-gold-300">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="New password" error={errors.newPassword} hint={PASSWORD_HINT}>
          <PasswordInput
            name="newPassword"
            autoComplete="new-password"
            placeholder="Create a strong password"
            value={newPassword}
            invalid={!!errors.newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </Field>

        <Field label="Confirm password" error={errors.confirmPassword}>
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={confirmPassword}
            invalid={!!errors.confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" fullWidth loading={loading}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
