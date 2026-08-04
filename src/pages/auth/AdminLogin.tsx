import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button, Field, Input, PasswordInput } from '@/components/ui';
import AuthLayout from '@/components/layout/AuthLayout';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const res = await login(email, password);
      const roles = res.user.roles;
      if (!roles.includes('STAFF') && !roles.includes('ADMIN')) {
        toast.error("This account doesn't have console access");
        return;
      }
      navigate('/admin', { replace: true });
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
      theme="admin"
      title="Admin Console"
      subtitle="Staff & administrator sign-in"
      footer={
        <Link to="/login" className="font-medium text-gold-400 hover:text-gold-300">
          Back to storefront sign-in
        </Link>
      }
    >
      <p className="mb-5 text-center text-xs font-semibold uppercase tracking-widest text-gold-400">Admin Console</p>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email address" error={errors.email}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="staff@amanly.in"
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

        <Button type="submit" fullWidth loading={loading}>
          Sign in to console
        </Button>
      </form>
    </AuthLayout>
  );
}
