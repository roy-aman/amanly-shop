import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { LinkButton, Spinner } from '@/components/ui';
import AuthLayout from '@/components/layout/AuthLayout';
import { ApiError } from '@/lib/http';

/**
 * Landing page for the "confirm joining this store" email.
 *
 * Registering with an address that already exists elsewhere on the platform creates
 * nothing — the password is held with a single-use token and the account, membership
 * and password all appear only when this page spends it. There is nothing to collect
 * here, so the exchange runs on mount and the visitor lands signed in.
 */
export default function JoinStore() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { completeStoreJoin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [errorMessage, setErrorMessage] = useState('');

  // The token is single-use, and StrictMode invokes effects twice in development.
  // Without this guard the second run spends an already-consumed token and the
  // visitor sees a failure for a join that actually succeeded.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    completeStoreJoin(token)
      .then(() => {
        toast.success('Welcome', 'Your account is ready.');
        navigate('/', { replace: true });
      })
      .catch((err) => {
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : 'We could not confirm this link. It may have expired or already been used.',
        );
      });
  }, [token, completeStoreJoin, navigate, toast]);

  const backLink = (
    <Link
      to="/login"
      className="font-medium text-slate-100 underline decoration-ink-600 underline-offset-4 transition hover:decoration-slate-100"
    >
      Back to sign in
    </Link>
  );

  if (!token) {
    return (
      <AuthLayout title="Invalid link" subtitle="This confirmation link is missing or malformed." footer={backLink}>
        <p className="mb-5 text-center text-sm text-slate-400">
          Open the link from your confirmation email, or create your account again to receive a new one.
        </p>
        <LinkButton to="/register" fullWidth>
          Start again
        </LinkButton>
      </AuthLayout>
    );
  }

  if (errorMessage) {
    return (
      <AuthLayout title="Confirmation failed" subtitle="We couldn't finish setting up your account." footer={backLink}>
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10">
            <XCircle className="h-6 w-6 text-rose-400" />
          </div>
          <p className="text-sm text-slate-400">{errorMessage}</p>
        </div>
        <LinkButton to="/register" fullWidth>
          Start again
        </LinkButton>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Setting up your account" subtitle="This only takes a moment.">
      <div className="flex justify-center py-4">
        <Spinner className="h-8 w-8" />
      </div>
    </AuthLayout>
  );
}
