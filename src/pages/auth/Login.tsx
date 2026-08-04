import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button, Field, Input, PasswordInput } from '@/components/ui';
import AuthLayout from '@/components/layout/AuthLayout';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrorMap());
        if (!err.hasFieldErrors()) {
          const message =
            err.code === 'AUTHENTICATION_FAILED' ? 'Invalid email or password. Please try again.' : err.message;
          toast.error('Sign in failed', message);
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
      title="Welcome back"
      subtitle="Sign in to your account to continue"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-slate-100 underline decoration-ink-600 underline-offset-4 transition hover:decoration-slate-100">
            Create one
          </Link>
        </>
      }
    >
      <GoogleSignInButton label="Continue with Google" dividerText="or sign in with email" />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
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

        <Field label="Password" error={errors.password}>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            invalid={!!errors.password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <div className="text-right">
          <Link to="/forgot-password" className="text-caption text-slate-500 underline-offset-4 transition hover:text-slate-100 hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth loading={loading}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
