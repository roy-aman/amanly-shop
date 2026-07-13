import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { resendEmailVerification, verifyEmail } from '@/api/auth';
import { ApiError } from '@/lib/http';
import { useToast } from '@/context/ToastContext';
import { Button, Field, Input, LinkButton, Spinner } from '@/components/ui';
import AuthLayout from '@/components/layout/AuthLayout';

type VerifyState = 'verifying' | 'success' | 'error';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const toast = useToast();

  const [state, setState] = useState<VerifyState | null>(token ? 'verifying' : null);
  const [errorMessage, setErrorMessage] = useState('');

  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmail(token)
      .then(() => setState('success'))
      .catch((err) => {
        setState('error');
        setErrorMessage(
          err instanceof ApiError ? err.message : 'We could not verify your email. The link may have expired.',
        );
      });
  }, [token]);

  async function onResend(e: FormEvent) {
    e.preventDefault();
    setResending(true);
    try {
      await resendEmailVerification(email);
      setResent(true);
      toast.success('Verification sent', 'Check your inbox for the new link.');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error('Could not resend', err.message);
      } else {
        toast.error('Unexpected error', String(err));
      }
    } finally {
      setResending(false);
    }
  }

  const backLink = (
    <Link to="/login" className="font-medium text-gold-400 hover:text-gold-300">
      Back to sign in
    </Link>
  );

  const resendForm = (
    <form onSubmit={onResend} className="space-y-4" noValidate>
      <Field label="Email address" hint="We'll send a fresh verification link to this address.">
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
      <Button type="submit" fullWidth loading={resending}>
        {resent ? 'Resend verification email' : 'Send verification email'}
      </Button>
    </form>
  );

  if (state === 'verifying') {
    return (
      <AuthLayout title="Verifying your email" subtitle="Please wait a moment.">
        <div className="flex justify-center py-4">
          <Spinner className="h-8 w-8" />
        </div>
      </AuthLayout>
    );
  }

  if (state === 'success') {
    return (
      <AuthLayout title="Email verified" subtitle="Your email address has been confirmed." footer={backLink}>
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="text-sm text-slate-300">You&apos;re all set — sign in to continue.</p>
        </div>
        <LinkButton to="/login" fullWidth>
          Continue to sign in
        </LinkButton>
      </AuthLayout>
    );
  }

  if (state === 'error') {
    return (
      <AuthLayout title="Verification failed" subtitle="We couldn't verify your email." footer={backLink}>
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10">
            <XCircle className="h-6 w-6 text-rose-400" />
          </div>
          <p className="text-sm text-slate-400">{errorMessage}</p>
        </div>
        <p className="mb-4 text-center text-sm text-slate-400">Request a new verification link below.</p>
        {resendForm}
      </AuthLayout>
    );
  }

  // No token — show only the resend form with instructions.
  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter your email to receive a verification link"
      footer={backLink}
    >
      {resendForm}
    </AuthLayout>
  );
}
