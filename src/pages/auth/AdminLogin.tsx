import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button, Field, Input, PasswordInput } from '@/components/ui';
import AuthLayout from '@/components/layout/AuthLayout';
import OtpChallengeForm from '@/components/auth/OtpChallengeForm';
import type { OtpChallengeResponse, RoleName } from '@/lib/types';

/**
 * This door is for platform operators only. Store staff and administrators sign in on the
 * storefront at /login like everyone else, and reach their console from the account menu — their
 * account is a member of that store, so there is nothing separate to log into.
 *
 * Note this cannot be a "does the account have STAFF or ADMIN" test. A platform operator is granted
 * every store role at every store (StoreMembershipService.effectiveRoles), so their roles array
 * always contains STAFF and ADMIN too. Only PLATFORM_ADMIN distinguishes them, which is why it is
 * the only thing checked here.
 */
function isPlatformOperator(roles: RoleName[]): boolean {
  return roles.includes('PLATFORM_ADMIN');
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallengeResponse | null>(null);

  /**
   * The sign-in itself succeeded either way — the session is real and the tokens are stored. Someone
   * who is staff rather than an operator is therefore sent on to the storefront rather than being
   * refused or signed back out, which would strand a valid session on a dead page. Their console is
   * one click away in the account menu.
   */
  function landAfterSignIn(roles: RoleName[]) {
    if (isPlatformOperator(roles)) {
      navigate('/platform', { replace: true });
      return;
    }
    toast.info(
      'Signed in on the storefront',
      'This page is for platform operators. Staff and administrators sign in here and open the admin console from the account menu.',
    );
    navigate('/', { replace: true });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const res = await login(email, password, 'platform');
      // A platform operator's password alone is not enough — their credential
      // reaches every merchant, so the API withholds the session until the code.
      if (res.kind === 'otpRequired') {
        setChallenge(res.challenge);
        return;
      }
      landAfterSignIn(res.auth.user.roles);
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

  if (challenge) {
    return (
      <AuthLayout theme="admin" title="Verify it's you" subtitle="Platform operators sign in in two steps">
        <OtpChallengeForm
          email={email}
          challenge={challenge}
          via="platform"
          onVerified={(auth) => landAfterSignIn(auth.user.roles)}
          onStartOver={() => {
            setChallenge(null);
            setPassword('');
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      theme="admin"
      title="Platform Console"
      subtitle="Platform operator sign-in"
      footer={
        <Link to="/login" className="font-medium text-slate-100 underline decoration-ink-600 underline-offset-4 transition hover:decoration-slate-100">
          Staff & administrators sign in here
        </Link>
      }
    >
      <p className="mb-5 text-center text-xs font-semibold uppercase tracking-widest text-gold-400">Platform Console</p>
      <p className="mb-5 text-center text-caption text-slate-400">
        For operators who administer the platform itself. If you run or work in a shop, sign in on the storefront —
        your admin console is in the account menu once you are in.
      </p>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email address" error={errors.email}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="operator@amanly.in"
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
