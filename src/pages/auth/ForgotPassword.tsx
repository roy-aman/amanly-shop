import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { forgotPassword } from '@/api/auth';
import { ApiError } from '@/lib/http';
import { useToast } from '@/context/ToastContext';
import { Button, Field, Input } from '@/components/ui';
import AuthLayout from '@/components/layout/AuthLayout';

export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
    } catch (err) {
      // Intentionally swallow errors to avoid user enumeration — the panel is
      // always shown regardless of whether the account exists.
      if (!(err instanceof ApiError)) {
        toast.error('Unexpected error', String(err));
      }
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  const backLink = (
    <Link to="/login" className="font-medium text-gold-400 hover:text-gold-300">
      Back to sign in
    </Link>
  );

  if (sent) {
    return (
      <AuthLayout title="Check your email" footer={backLink}>
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <MailCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="text-sm text-slate-300">
            If an account exists for that email, we&apos;ve sent a reset link.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot password?" subtitle="Enter your email and we'll send you a reset link" footer={backLink}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email address">
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" fullWidth loading={loading}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
