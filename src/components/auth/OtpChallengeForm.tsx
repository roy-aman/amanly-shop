import { useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/AuthContext';
import { Button, Field, Input } from '@/components/ui';
import type { EntryPoint } from '@/lib/http';
import type { AuthResponse, OtpChallengeResponse } from '@/lib/types';

/** Five wrong guesses burn the code server-side; we count locally so the user
 *  is told to start over rather than discovering a dead code by trial. */
const MAX_ATTEMPTS = 5;
const CODE_LENGTH = 6;

/**
 * Second step of a platform operator's sign-in (202 → OTP_REQUIRED).
 *
 * Shared by the storefront and console login screens because an operator may
 * arrive at either. Deliberately a *typed input*: `challenge.otp` is only
 * populated while a dev flag exposes it (outbound email is not wired up yet),
 * so it prefills the field but is never the only way through.
 *
 * A wrong, expired and already-spent code all return `401 INVALID_OTP` — the
 * API will not say which, so neither do we.
 */
export default function OtpChallengeForm({
  email,
  challenge,
  onVerified,
  onStartOver,
  via = 'store',
}: {
  email: string;
  challenge: OtpChallengeResponse;
  onVerified: (auth: AuthResponse) => void;
  onStartOver: () => void;
  /** Which door this challenge was raised at — carried through so the finished
   *  session lands in the same context the sign-in started in. */
  via?: EntryPoint;
}) {
  const { verifyLoginOtp } = useAuth();

  const [code, setCode] = useState(challenge.otp ?? '');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

  const burned = attempts >= MAX_ATTEMPTS;
  const remaining = MAX_ATTEMPTS - attempts;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (burned) return;
    setError(null);
    setLoading(true);
    try {
      onVerified(await verifyLoginOtp(email, code.trim(), via));
    } catch (err) {
      const next = attempts + 1;
      setAttempts(next);
      setCode('');
      if (next >= MAX_ATTEMPTS) {
        setError('That code is now locked. Sign in again to get a new one.');
      } else if (err instanceof ApiError && err.code === 'INVALID_OTP') {
        setError(`That code is wrong, expired or already used. ${MAX_ATTEMPTS - next} tries left.`);
      } else {
        setError(err instanceof Error ? err.message : 'Could not verify the code.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="flex items-start gap-3 rounded-lg border border-ink-700 bg-ink-850 p-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" aria-hidden />
        <div className="text-body-sm text-slate-300">
          <p className="font-medium text-slate-100">Extra step for platform operators</p>
          <p className="mt-1">
            {challenge.message || `We sent a ${CODE_LENGTH}-digit code to ${email}.`} It expires in 10 minutes and
            works once.
          </p>
        </div>
      </div>

      {challenge.otp ? (
        // Development only: the backend returns the code because outbound email
        // is not wired up yet. Labelled so nobody mistakes it for production UI.
        <p className="rounded-lg border border-warning-300/40 bg-warning-500/10 px-3 py-2 text-caption text-warning-300">
          Dev mode: the API returned the code, so it has been filled in for you.
        </p>
      ) : null}

      <Field label="Verification code" error={error ?? undefined}>
        <Input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          placeholder="123456"
          value={code}
          invalid={!!error}
          disabled={burned}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          autoFocus
          required
        />
      </Field>

      {burned ? (
        <Button type="button" fullWidth onClick={onStartOver}>
          Start over
        </Button>
      ) : (
        <>
          <Button type="submit" fullWidth loading={loading} disabled={code.trim().length !== CODE_LENGTH}>
            <KeyRound className="h-4 w-4" aria-hidden /> Verify and sign in
          </Button>
          <button
            type="button"
            onClick={onStartOver}
            className="w-full text-center text-caption text-slate-500 underline-offset-4 transition hover:text-slate-100 hover:underline"
          >
            Use a different account
          </button>
          {attempts > 0 && !burned ? (
            <p className="text-center text-caption text-slate-500">{remaining} of {MAX_ATTEMPTS} tries left</p>
          ) : null}
        </>
      )}
    </form>
  );
}
