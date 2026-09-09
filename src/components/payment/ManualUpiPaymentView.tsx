import React, { useState, useEffect, useId } from 'react';
import { Smartphone, QrCode, Copy, Check, ExternalLink, ShieldCheck, Info } from 'lucide-react';
import type { ManualUpiPayment } from '../../lib/types';
import { money } from '../../lib/format';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { cn } from '../ui/cn';

export interface ManualUpiPaymentViewProps {
  payment: ManualUpiPayment;
  confirming?: boolean;
  showMarkDone?: boolean;
  onMarkDone: () => void;
  customerName?: string | null;
  className?: string;
  defaultMode?: 'phone' | 'qr';
}

/** Official NPCI UPI Chevron Mark */
export function UpiIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 4L14 16L4 28H10L20 16L10 4H4Z" fill="#097939" />
      <path d="M12 4L22 16L12 28H18L28 16L18 4H12Z" fill="#ED752E" />
    </svg>
  );
}

/** Google Pay Iconic G Emblem */
export function GooglePayIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
    </svg>
  );
}

/** PhonePe Official Icon */
export function PhonePeIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="24" height="24" rx="12" fill="#5F259F" />
      <path d="M14.5 5.5v2.8h-1.8c-1.2 0-1.8.6-1.8 1.5v.7h3.4l-.4 2.8H10.9v5.2H8.2V10.5H6.8V7.7h1.4V6.9c0-2 1.3-3.4 3.5-3.4h2.8v2z" fill="#FFFFFF" />
    </svg>
  );
}

/** Paytm Official Icon */
export function PaytmIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#002E6E" />
      <path d="M6 8h4.5c1.4 0 2.5 1.1 2.5 2.5S11.9 13 10.5 13H8.5v3H6V8zm2.5 3h2c.3 0 .5-.2.5-.5s-.2-.5-.5-.5h-2v1z" fill="#00BAF2" />
      <path d="M14 8h2.5v8H14v-8zm1.25-3a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z" fill="#00BAF2" />
    </svg>
  );
}

/** BHIM Official Icon */
export function BhimIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#00796B" />
      <path d="M7 5l6 7-6 7h4l6-7-6-7H7z" fill="#FFFFFF" />
      <path d="M13 5l4 7-4 7h3l4-7-4-7h-3z" fill="#F58220" />
    </svg>
  );
}

/** CRED Official Icon */
export function CredIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#1C1C1E" />
      <path d="M6 7h12v10H6V7zm2 2v6h8V9H8zm2 2h4v2h-4v-2z" fill="#FFFFFF" />
    </svg>
  );
}

/** Renders the icon of the selected app, or the UPI logo when generic */
export function AppOrUpiIcon({ app, className = 'h-5 w-5' }: { app?: string | null; className?: string }) {
  const normalized = app ? app.toUpperCase().replace(/\s+/g, '_') : null;
  switch (normalized) {
    case 'GOOGLE_PAY':
    case 'GPAY':
    case 'TEZ':
      return <GooglePayIcon className={className} />;
    case 'PHONEPE':
      return <PhonePeIcon className={className} />;
    case 'PAYTM':
      return <PaytmIcon className={className} />;
    case 'BHIM':
      return <BhimIcon className={className} />;
    case 'CRED':
      return <CredIcon className={className} />;
    default:
      return <UpiIcon className={className} />;
  }
}

/** Check if the current client is a mobile device */
function detectMobile(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

/** Builds an app-specific deep link from the canonical upi://pay URI */
export function getAppSpecificUri(upiUri: string, appKey?: string | null): string {
  if (!upiUri) return '';
  if (!appKey) return upiUri;
  const query = upiUri.includes('?') ? upiUri.split('?')[1] : '';
  switch (appKey.toUpperCase()) {
    case 'PHONEPE':
      return `phonepe://pay?${query}`;
    case 'GOOGLE_PAY':
    case 'GPAY':
      return `tez://upi/pay?${query}`;
    case 'PAYTM':
      return `paytmmp://pay?${query}`;
    case 'BHIM':
      return `bhim://pay?${query}`;
    case 'CRED':
      return `credpay://upi/pay?${query}`;
    default:
      return upiUri;
  }
}

export function ManualUpiPaymentView({
  payment,
  confirming = false,
  showMarkDone = false,
  onMarkDone,
  customerName,
  className,
  defaultMode,
}: ManualUpiPaymentViewProps) {
  const [isMobile] = useState<boolean>(() => (defaultMode ? defaultMode === 'phone' : detectMobile()));
  const [mode, setMode] = useState<'phone' | 'qr'>(() => defaultMode ?? (detectMobile() ? 'phone' : 'qr'));
  const [copied, setCopied] = useState(false);
  const [appLaunched, setAppLaunched] = useState(false);

  const phoneTabId = useId();
  const qrTabId = useId();

  const upiUri = payment.upiUri || '';
  const isTokenFlowWithApp = Boolean(payment.tokenVerificationEnabled && payment.app);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopyVpa() {
    try {
      await navigator.clipboard.writeText(payment.vpa);
      setCopied(true);
    } catch {
      setCopied(true);
    }
  }

  function handleAppClick() {
    setAppLaunched(true);
  }

  return (
    <div className={cn('flex flex-col items-center gap-4 py-1 text-center w-full max-w-sm mx-auto', className)}>
      {/* Amount & Payee Header */}
      <div className="w-full">
        <p className="text-h2 font-display font-bold text-slate-100 tabular-nums">
          {money(payment.amount, payment.currency)}
        </p>
        <div className="mt-1 flex items-center justify-center gap-2 text-body-sm text-slate-500">
          <span>to <strong className="font-semibold text-slate-200">{payment.vpa}</strong></span>
          <button
            type="button"
            onClick={handleCopyVpa}
            className="inline-flex items-center gap-1 rounded-md bg-ink-850 px-2.5 py-1 text-caption font-medium text-slate-700 dark:text-slate-200 hover:bg-ink-800 transition border border-ink-600 cursor-pointer active:scale-95"
            title="Copy UPI ID"
            aria-label="Copy UPI ID"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-500" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Segmented Mode Selector: Pay on this phone vs Scan QR Code */}
      <div
        className="grid w-full grid-cols-2 rounded-xl bg-ink-800 p-1 border border-ink-700"
        role="tablist"
        aria-label="UPI payment options"
      >
        <button
          type="button"
          role="tab"
          id={phoneTabId}
          aria-selected={mode === 'phone'}
          aria-controls="phone-panel"
          onClick={() => setMode('phone')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-caption font-semibold transition cursor-pointer',
            mode === 'phone'
              ? 'bg-primary text-primary-fg shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-ink-700/50'
          )}
        >
          <Smartphone className="h-4 w-4 shrink-0 text-current" />
          <span>Pay on this phone</span>
        </button>

        <button
          type="button"
          role="tab"
          id={qrTabId}
          aria-selected={mode === 'qr'}
          aria-controls="qr-panel"
          onClick={() => setMode('qr')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-caption font-semibold transition cursor-pointer',
            mode === 'qr'
              ? 'bg-primary text-primary-fg shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-ink-700/50'
          )}
        >
          <QrCode className="h-4 w-4 shrink-0 text-current" />
          <span>Scan QR Code</span>
        </button>
      </div>

      {/* Mode 1: Pay on this phone */}
      {mode === 'phone' && (
        <div id="phone-panel" role="tabpanel" aria-labelledby={phoneTabId} className="w-full space-y-4 pt-1">
          {!isMobile && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-caption text-amber-800 dark:text-amber-200">
                <span>Direct app pay works best on mobile phones with UPI apps installed. If on a computer, you can </span>
                <button
                  type="button"
                  onClick={() => setMode('qr')}
                  className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-100 cursor-pointer"
                >
                  Scan the QR code
                </button>
                <span> instead.</span>
              </div>
            </div>
          )}

          {/* Primary App Launch Action */}
          <div className="space-y-2">
            <a
              href={getAppSpecificUri(upiUri, isTokenFlowWithApp ? payment.app : null)}
              onClick={handleAppClick}
              className="flex w-full items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-fg shadow-sm transition duration-200 hover:bg-primary-hover active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-xs">
                  <AppOrUpiIcon app={isTokenFlowWithApp ? payment.app : null} className="h-5 w-5 shrink-0" />
                </span>
                <span className="text-primary-fg font-semibold text-base">
                  {isTokenFlowWithApp ? `Pay with ${payment.appLabel || 'UPI'}` : 'Pay via UPI'}
                </span>
              </div>
              <ExternalLink className="h-4 w-4 text-primary-fg/80 shrink-0" />
            </a>
            <p className="text-caption text-slate-600 dark:text-slate-400">
              {isTokenFlowWithApp
                ? `Tap to launch ${payment.appLabel || 'your chosen app'} with amount and payee prefilled.`
                : 'Tap to open your installed UPI app with amount and payee prefilled.'}
            </p>
          </div>

          {/* Token display box under token verification */}
          {payment.tokenVerificationEnabled && (
            <div className="w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-left shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-overline uppercase tracking-wider text-slate-500 font-semibold text-xs">
                  Your Payment Token{payment.appLabel ? ` • ${payment.appLabel}` : ''}
                </p>
                <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Verified
                </span>
              </div>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums tracking-wide text-slate-100">
                {customerName ? `${customerName}: ${payment.token}` : payment.token}
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 text-caption text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Secure 1-tap payment via official UPI intent</span>
          </div>
        </div>
      )}

      {/* Mode 2: Scan QR Code */}
      {mode === 'qr' && (
        <div id="qr-panel" role="tabpanel" aria-labelledby={qrTabId} className="w-full space-y-3 pt-1 flex flex-col items-center">
          <div className="relative rounded-2xl border border-ink-600 bg-white p-3 shadow-md">
            <img
              src={payment.qrDataUri}
              alt="Scan to pay via UPI"
              className="h-52 w-52 object-contain"
            />
            <div className="absolute inset-x-0 -bottom-3 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 bg-white px-3 py-0.5 text-[11px] font-semibold text-slate-800 shadow-xs">
                <UpiIcon className="h-3.5 w-3.5" />
                <span>Scan with any UPI app</span>
              </span>
            </div>
          </div>

          <p className="text-body-sm text-slate-500 pt-2">
            Scan using Google Pay, PhonePe, Paytm or any UPI app.
          </p>

          {/* Token display under verification */}
          {payment.tokenVerificationEnabled && (
            <div className="w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-left shadow-xs">
              <p className="text-overline uppercase tracking-wider text-slate-500 font-semibold text-xs">
                Your payment token{payment.appLabel ? ` • ${payment.appLabel}` : ''}
              </p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-100">
                {customerName ? `${customerName}: ${payment.token}` : payment.token}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action Footer: Confirming / Mark Payment Done */}
      <div className="w-full pt-2 border-t border-ink-700 space-y-2">
        {confirming ? (
          <div className="flex items-center justify-center gap-2 text-body-sm text-slate-500 py-1">
            <Spinner className="h-4 w-4" />
            <span>Confirming your payment…</span>
          </div>
        ) : showMarkDone ? (
          <Button onClick={onMarkDone} variant="primary" className="w-full">
            Mark payment done
          </Button>
        ) : (
          <div className="text-caption text-slate-500">
            {appLaunched
              ? 'Complete the payment in your UPI app, then tap Mark payment done.'
              : mode === 'phone'
                ? (isTokenFlowWithApp ? `Open ${payment.appLabel || 'UPI'} to complete payment.` : 'Open your UPI app to complete payment.')
                : 'Scan the QR and pay the amount above.'}
          </div>
        )}

        <p className="text-caption text-slate-500">
          {confirming
            ? 'Confirming payment — you will be redirected to your order details shortly.'
            : showMarkDone
              ? "Once you've paid, tap Mark payment done to proceed."
              : mode === 'phone'
                ? 'Opening your UPI app does not finalize the order. Return here to mark payment done.'
                : 'Scan the QR with any UPI app to pay.'}
        </p>
      </div>
    </div>
  );
}
