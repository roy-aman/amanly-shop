import { useEffect, useState } from 'react';
import { request } from '@/lib/http';
import { Button } from '@/components/ui';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

// Cache the provider lookup for the lifetime of the tab so both Login and
// Register don't each hit the endpoint. `undefined` = not yet fetched.
let googleEnabledCache: boolean | undefined;
let inFlight: Promise<boolean> | null = null;

async function fetchGoogleEnabled(): Promise<boolean> {
  if (googleEnabledCache !== undefined) return googleEnabledCache;
  if (!inFlight) {
    inFlight = request<{ google?: boolean }>('GET', '/api/v1/auth/providers')
      .then((res) => !!res.google)
      .catch(() => false)
      .then((enabled) => {
        googleEnabledCache = enabled;
        inFlight = null;
        return enabled;
      });
  }
  return inFlight;
}

/**
 * Kicks off the Google OAuth2 flow. Both sign-in and sign-up funnel through the
 * same backend endpoint — the first successful Google login auto-provisions the
 * account, so "Continue with Google" doubles as registration.
 *
 * Renders nothing until it confirms the backend actually has Google OAuth wired
 * (GET /api/v1/auth/providers). This avoids showing a button that would 404 the
 * /oauth2/authorization/google endpoint when GOOGLE_CLIENT_ID isn't configured.
 * When hidden, the optional email divider is hidden with it (they belong together).
 */
export default function GoogleSignInButton({
  label = 'Continue with Google',
  dividerText,
}: {
  label?: string;
  dividerText?: string;
}) {
  const [enabled, setEnabled] = useState<boolean>(googleEnabledCache ?? false);

  useEffect(() => {
    let active = true;
    fetchGoogleEnabled().then((v) => {
      if (active) setEnabled(v);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        fullWidth
        onClick={() => {
          window.location.href = '/oauth2/authorization/google';
        }}
      >
        <GoogleIcon />
        {label}
      </Button>

      {dividerText && (
        <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-ink-700" />
          {dividerText}
          <span className="h-px flex-1 bg-ink-700" />
        </div>
      )}
    </>
  );
}
