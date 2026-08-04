import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button, Field, Input, PasswordInput } from '@/components/ui';
import AuthLayout from '@/components/layout/AuthLayout';
import GoogleSignInButton from '@/components/GoogleSignInButton';

const PASSWORD_HINT = 'At least 12 characters with uppercase, lowercase, a digit and a special character.';

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    try {
      await register(email, fullName, password);
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
