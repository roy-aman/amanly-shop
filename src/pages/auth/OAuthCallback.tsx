import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TokenStore } from '@/lib/http';
import type { UserResponse } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui';
import AuthLayout from '@/components/layout/AuthLayout';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Backend returns tokens in the URL hash fragment
    // (e.g. #accessToken=...&refreshToken=...&expiresIn=...&error=...).
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const expiresIn = parseInt(params.get('expiresIn') || '0', 10);
    const error = params.get('error');

    // Strip tokens from the address bar immediately.
    history.replaceState(null, '', window.location.pathname);

    if (error || !accessToken || !refreshToken) {
      setFailed(true);
      return;
    }

    // Persist tokens (user is fetched right after via /users/me).
    TokenStore.save({
      tokenType: 'Bearer',
      accessToken,
      refreshToken,
      expiresInSeconds: expiresIn,
      user: null as unknown as UserResponse,
    });

    refreshUser()
      .then(() => navigate('/', { replace: true }))
      .catch(() => {
        TokenStore.clear();
        setFailed(true);
      });
  }, [navigate, refreshUser]);

  if (failed) {
    return (
      <AuthLayout
        title="Sign-in failed"
        subtitle="We couldn't complete your Google sign-in."
        footer={
          <Link to="/login" className="font-medium text-slate-100 underline decoration-ink-600 underline-offset-4 transition hover:decoration-slate-100">
            Back to sign in
          </Link>
        }
      >
        <p className="text-center text-sm text-slate-400">
          Something went wrong finishing your sign-in. Please try again.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Completing sign-in…" subtitle="Securely finishing your Google login.">
      <div className="flex justify-center py-4">
        <Spinner className="h-8 w-8" />
      </div>
    </AuthLayout>
  );
}
