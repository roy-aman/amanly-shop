import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button, Field, Input, LinkButton, PasswordInput } from '@/components/ui';
import AuthLayout from '@/components/layout/AuthLayout';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { PASSWORD_HINT } from '@/lib/passwordRules';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [joinPending, setJoinPending] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    try {
      const res = await register(email, fullName, password);
      // 202: this address already exists elsewhere on the platform. Nothing was
      // created and no session exists — the emailed link finishes the job.
      if (res.kind === 'joinPending') {
        setJoinPending(res.pending.message);
        return;
      }
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrorMap());
        if (!err.hasFieldErrors()) {
          const message =
            err.status === 409 ? 'This email is already registered. Please sign in instead.' : err.message;
          toast.error('Registration failed', message);
        }
      } else {
        toast.error('Unexpected error', String(err));
      }
    } finally {
      setLoading(false);
    }
  }

  if (joinPending) {
    return (
      <AuthLayout title="Check your email" subtitle="One more step to finish setting up your account">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <MailCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="text-sm text-slate-300">{joinPending}</p>
          <p className="mt-3 text-sm text-slate-400">
            We sent a confirmation link to <span className="text-slate-200">{email}</span>. Your account and
            password are created when you open it.
          </p>
        </div>
        <LinkButton to="/login" fullWidth>
          Back to sign in
        </LinkButton>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Create your Amanly account"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-slate-100 underline decoration-ink-600 underline-offset-4 transition hover:decoration-slate-100">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleSignInButton label="Sign up with Google" dividerText="or sign up with email" />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" error={errors.fullName}>
          <Input
            type="text"
            name="fullName"
            autoComplete="name"
            placeholder="Your full name"
            value={fullName}
            invalid={!!errors.fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </Field>

        <Field label="Email address" error={errors.email}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            invalid={!!errors.email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <Field label="Password" error={errors.password} hint={PASSWORD_HINT}>
          <PasswordInput
            name="password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            value={password}
            invalid={!!errors.password}
            onChange={(e) => setPassword(e.target.value)}
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
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
