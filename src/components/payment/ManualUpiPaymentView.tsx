import React, { useState, useId, useMemo } from 'react';
import { Smartphone, QrCode, Copy, Check, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { ManualUpiPayment, UpiApp } from '../../lib/types';
import { money } from '../../lib/format';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { cn } from '../ui/cn';
import { updateManualUpiApp } from '../../api/orders';

export interface ManualUpiPaymentViewProps {
  payment: ManualUpiPayment;
  orderId?: string | null;
  confirming?: boolean;
  showMarkDone?: boolean;
  onMarkDone: () => void;
  customerName?: string | null;
  className?: string;
  defaultMode?: 'phone' | 'qr';
  onAppChange?: (app: string | null) => void;
}

export interface UpiAppChoice {
  key: string | null;
  label: string;
  shortLabel: string;
}

/** Supported UPI compatible apps with official brand schemes */
export const AVAILABLE_UPI_APPS: UpiAppChoice[] = [
  { key: null, label: 'Any UPI App', shortLabel: 'Any UPI' },
  { key: 'GOOGLE_PAY', label: 'Google Pay', shortLabel: 'Google Pay' },
  { key: 'PHONEPE', label: 'PhonePe', shortLabel: 'PhonePe' },
  { key: 'PAYTM', label: 'Paytm', shortLabel: 'Paytm' },
  { key: 'BHIM', label: 'BHIM', shortLabel: 'BHIM' },
  { key: 'CRED', label: 'CRED', shortLabel: 'CRED' },
];

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
  switch (appKey.toUpperCase().replace(/\s+/g, '_')) {
    case 'PHONEPE':
      return `phonepe://pay?${query}`;
    case 'GOOGLE_PAY':
    case 'GPAY':
    case 'TEZ':
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
  orderId,
  confirming = false,
  showMarkDone = false,
  onMarkDone,
  customerName,
  className,
  defaultMode,
  onAppChange,
}: ManualUpiPaymentViewProps) {
  const [isMobile] = useState<boolean>(() => (defaultMode ? defaultMode === 'phone' : detectMobile()));
  const [mode, setMode] = useState<'phone' | 'qr'>(() => defaultMode ?? (detectMobile() ? 'phone' : 'qr'));
  const [copied, setCopied] = useState(false);
  const [appLaunched, setAppLaunched] = useState(false);

  // Active selected app key (e.g. 'PHONEPE', 'GOOGLE_PAY', or null for Any UPI)
  const [activeAppKey, setActiveAppKey] = useState<string | null>(() => {
    if (payment.app && payment.app !== 'OTHER') return payment.app;
    return null;
  });

  const [activeAppLabel, setActiveAppLabel] = useState<string | null>(() => {
    if (payment.app && payment.app !== 'OTHER') return payment.appLabel || payment.app;
    return null;
  });

  // Dynamically resolve target from admin-defined appTargets
  const selectedTarget = useMemo(() => {
    if (!payment.appTargets || payment.appTargets.length === 0) {
      return null;
    }
    if (activeAppKey) {
      const match = payment.appTargets.find((t) => t.app === activeAppKey);
      if (match) return match;
    }
    // Fall back to common target (app === null) or first available
    return payment.appTargets.find((t) => t.app === null) || payment.appTargets[0] || null;
  }, [payment.appTargets, activeAppKey]);

  // Effective VPA, QR code, and UPI URI
  const effectiveVpa = selectedTarget?.vpa || payment.vpa;
  const effectiveQr = selectedTarget?.qrDataUri || payment.qrDataUri;
  const effectiveUpiUri = selectedTarget?.upiUri || payment.upiUri || '';

  // Check if the selected app has a direct admin-configured account
  const isDirectAdminAccount = Boolean(
    activeAppKey && payment.appTargets?.some((t) => t.app === activeAppKey)
  );

  const phoneTabId = useId();
  const qrTabId = useId();

  const handleCopyVpa = async () => {
    if (!effectiveVpa) return;
    try {
      await navigator.clipboard.writeText(effectiveVpa);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAppClick = () => {
    setAppLaunched(true);
  };

  const handleSelectApp = (appOption: UpiAppChoice) => {
    setActiveAppKey(appOption.key);
    setActiveAppLabel(appOption.key ? appOption.label : null);
    if (orderId) {
      updateManualUpiApp(orderId, (appOption.key as UpiApp) || null).catch(() => {
        // Silently ignore best-effort update
      });
    }
    if (onAppChange) {
      onAppChange(appOption.key);
    }
  };

  return (
    <div className={cn('w-full max-w-md mx-auto space-y-4 text-center select-none', className)}>
      {/* Amount & Merchant Header */}
      <div className="space-y-1">
        <p className="text-caption text-slate-500 font-medium">Total Amount to Pay</p>
        <p className="text-3xl font-extrabold tracking-tight text-slate-100">
          {money(payment.amount, payment.currency)}
        </p>
      </div>

      {/* Payee VPA pill with 1-tap copy */}
      <div className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-600 bg-ink-850 px-3.5 py-1.5 text-xs text-slate-300">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white p-0.5 shadow-2xs">
          <AppOrUpiIcon app={activeAppKey} className="h-3 w-3 shrink-0" />
        </span>
        <span className="text-slate-400">UPI ID:</span>
        <span className="font-mono font-semibold text-slate-100">{effectiveVpa}</span>
        <button
          type="button"
          onClick={handleCopyVpa}
          className="ml-1 inline-flex items-center gap-1 text-slate-400 hover:text-slate-100 transition cursor-pointer"
          title="Copy UPI ID"
          aria-label="Copy UPI ID"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="text-[11px] font-medium">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Tabs: Pay on phone vs Scan QR */}
      <div className="flex rounded-xl bg-ink-800 p-1 border border-ink-600" role="tablist" aria-label="Payment modes">
        <button
          type="button"
          id={phoneTabId}
          role="tab"
          aria-selected={mode === 'phone'}
          aria-controls="phone-panel"
          onClick={() => setMode('phone')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition cursor-pointer',
            mode === 'phone'
              ? 'bg-primary text-primary-fg shadow-xs font-bold ring-1 ring-primary'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <Smartphone className="h-4 w-4" />
          <span>Pay on this phone</span>
        </button>

        <button
          type="button"
          id={qrTabId}
          role="tab"
          aria-selected={mode === 'qr'}
          aria-controls="qr-panel"
          onClick={() => setMode('qr')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition cursor-pointer',
            mode === 'qr'
              ? 'bg-primary text-primary-fg shadow-xs font-bold ring-1 ring-primary'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <QrCode className="h-4 w-4" />
          <span>Scan QR code</span>
        </button>
      </div>

      {/* Mode 1: Pay on this Phone */}
      {mode === 'phone' && (
        <div id="phone-panel" role="tabpanel" aria-labelledby={phoneTabId} className="w-full space-y-3 pt-1">
          {/* Primary App Launch Action */}
          <div className="space-y-2">
            <a
              href={getAppSpecificUri(effectiveUpiUri, activeAppKey)}
              onClick={handleAppClick}
              className="flex w-full items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-fg shadow-sm transition duration-200 hover:bg-primary-hover active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-xs">
                  <AppOrUpiIcon app={activeAppKey} className="h-5 w-5 shrink-0" />
                </span>
                <span className="text-primary-fg font-semibold text-base">
                  {activeAppLabel ? `Pay with ${activeAppLabel}` : 'Pay via any UPI App'}
                </span>
              </div>
              <ExternalLink className="h-4 w-4 text-primary-fg/80 shrink-0" />
            </a>
            <p className="text-caption text-slate-400">
              {activeAppLabel
                ? `Tap to launch ${activeAppLabel} with ${money(payment.amount, payment.currency)} prefilled.`
                : 'Tap to open your installed UPI app with amount and payee prefilled.'}
            </p>
          </div>

          {/* UPI Apps Selection Grid */}
          <div className="w-full space-y-2 rounded-2xl border border-ink-600 bg-ink-850/50 p-3 text-left">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Select your UPI app
              </p>
              <span className="text-[11px] text-slate-400">1-tap select</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-0.5" role="radiogroup" aria-label="UPI app selection">
              {AVAILABLE_UPI_APPS.map((appOption) => {
                const isSelected = activeAppKey === appOption.key;
                return (
                  <button
                    key={appOption.key ?? 'ALL'}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectApp(appOption)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center transition cursor-pointer active:scale-95',
                      isSelected
                        ? 'border-primary bg-primary/10 dark:bg-primary/20 shadow-xs ring-1 ring-primary'
                        : 'border-ink-600 bg-ink-900 hover:border-slate-400 dark:hover:border-slate-600'
                    )}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white p-1 shadow-xs">
                      <AppOrUpiIcon app={appOption.key} className="h-5 w-5 shrink-0" />
                    </span>
                    <span className={cn('text-xs font-medium line-clamp-1', isSelected ? 'text-slate-100 font-semibold' : 'text-slate-300')}>
                      {appOption.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Token display box under token verification */}
          {payment.tokenVerificationEnabled && (
            <div className="w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-left shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-overline uppercase tracking-wider text-slate-400 font-semibold text-xs">
                  Your Payment Token{activeAppLabel ? ` • ${activeAppLabel}` : ''}
                </p>
                <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Verified
                </span>
              </div>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums tracking-wide text-slate-100">
                {customerName ? `${customerName}: ${payment.token}` : payment.token}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Quote this token or your name if asked by store staff to confirm receipt.
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 text-caption text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Secure 1-tap payment via official UPI intent</span>
          </div>
        </div>
      )}

      {/* Mode 2: Scan QR Code */}
      {mode === 'qr' && (
        <div id="qr-panel" role="tabpanel" aria-labelledby={qrTabId} className="w-full space-y-3 pt-1 flex flex-col items-center">
          {/* Dynamic App-Wise QR Code Box */}
          <div className="relative rounded-2xl border border-ink-600 bg-white p-3 shadow-md flex flex-col items-center">
            <img
              src={effectiveQr}
              alt="Scan to pay via UPI"
              className="h-52 w-52 object-contain"
            />
            <div className="absolute inset-x-0 -bottom-3 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 bg-white px-3 py-0.5 text-[11px] font-semibold text-slate-800 shadow-xs">
                <AppOrUpiIcon app={activeAppKey} className="h-3.5 w-3.5" />
                <span>{activeAppLabel ? `${activeAppLabel} QR Code` : 'Scan with any UPI app'}</span>
              </span>
            </div>
          </div>

          <p className="text-body-sm text-slate-400 pt-2">
            {activeAppLabel
              ? `Scan using ${activeAppLabel} to pay directly into merchant's account (${effectiveVpa}).`
              : `Scan using Google Pay, PhonePe, Paytm or any UPI app to pay (${effectiveVpa}).`}
          </p>

          {/* App Selector on QR tab too so user can choose which app's QR to view */}
          <div className="w-full space-y-2 rounded-2xl border border-ink-600 bg-ink-850/50 p-3 text-left">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Change QR code by app
              </p>
              <span className="text-[11px] text-slate-400">Updates QR instantly</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-0.5" role="radiogroup" aria-label="UPI QR app selection">
              {AVAILABLE_UPI_APPS.map((appOption) => {
                const isSelected = activeAppKey === appOption.key;
                return (
                  <button
                    key={appOption.key ?? 'ALL'}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectApp(appOption)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center transition cursor-pointer active:scale-95',
                      isSelected
                        ? 'border-primary bg-primary/10 dark:bg-primary/20 shadow-xs ring-1 ring-primary'
                        : 'border-ink-600 bg-ink-900 hover:border-slate-400 dark:hover:border-slate-600'
                    )}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white p-1 shadow-xs">
                      <AppOrUpiIcon app={appOption.key} className="h-5 w-5 shrink-0" />
                    </span>
                    <span className={cn('text-xs font-medium line-clamp-1', isSelected ? 'text-slate-100 font-semibold' : 'text-slate-300')}>
                      {appOption.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Token display under verification */}
          {payment.tokenVerificationEnabled && (
            <div className="w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-left shadow-xs">
              <p className="text-overline uppercase tracking-wider text-slate-400 font-semibold text-xs">
                Your payment token{activeAppLabel ? ` • ${activeAppLabel}` : ''}
              </p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-100">
                {customerName ? `${customerName}: ${payment.token}` : payment.token}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Quote this token or your name if asked by store staff to confirm receipt.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action Footer: Confirming / Mark Payment Done */}
      <div className="w-full pt-2 border-t border-ink-700 space-y-2">
        {confirming ? (
          <div className="flex items-center justify-center gap-2 text-body-sm text-slate-400 py-1">
            <Spinner className="h-4 w-4" />
            <span>Confirming your payment…</span>
          </div>
        ) : showMarkDone ? (
          <Button onClick={onMarkDone} variant="primary" className="w-full">
            Mark payment done
          </Button>
        ) : (
          <div className="text-caption text-slate-400">
            {appLaunched
              ? 'Complete the payment in your UPI app, then tap Mark payment done.'
              : mode === 'phone'
                ? (activeAppLabel ? `Open ${activeAppLabel} to complete payment.` : 'Open your UPI app to complete payment.')
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
