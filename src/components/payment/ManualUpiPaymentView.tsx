import React, { useState, useEffect, useId } from 'react';
import { Smartphone, QrCode, Copy, Check, ExternalLink, ShieldCheck, ArrowRight, Info } from 'lucide-react';
import type { ManualUpiPayment, UpiApp } from '../../lib/types';
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

interface QuickAppOption {
  key: string;
  label: string;
  colorClass: string;
  borderClass: string;
  textClass: string;
}

const POPULAR_UPI_APPS: QuickAppOption[] = [
  { key: 'PHONEPE', label: 'PhonePe', colorClass: 'bg-[#5f259f]/15', borderClass: 'border-[#5f259f]/40 hover:border-[#5f259f]', textClass: 'text-[#a768f5]' },
  { key: 'GOOGLE_PAY', label: 'Google Pay', colorClass: 'bg-[#1a73e8]/15', borderClass: 'border-[#1a73e8]/40 hover:border-[#1a73e8]', textClass: 'text-[#6ba1ff]' },
  { key: 'PAYTM', label: 'Paytm', colorClass: 'bg-[#00baf2]/15', borderClass: 'border-[#00baf2]/40 hover:border-[#00baf2]', textClass: 'text-[#00d2ff]' },
  { key: 'BHIM', label: 'BHIM', colorClass: 'bg-emerald-500/15', borderClass: 'border-emerald-500/40 hover:border-emerald-500', textClass: 'text-emerald-400' },
  { key: 'CRED', label: 'CRED', colorClass: 'bg-slate-800', borderClass: 'border-slate-600 hover:border-slate-400', textClass: 'text-slate-200' },
];

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
        <p className="text-h3 font-display text-slate-100 tabular-nums">
          {money(payment.amount, payment.currency)}
        </p>
        <div className="mt-1 flex items-center justify-center gap-2 text-body-sm text-slate-400">
          <span>to <strong className="font-medium text-slate-200">{payment.vpa}</strong></span>
          <button
            type="button"
            onClick={handleCopyVpa}
            className="inline-flex items-center gap-1 rounded-md bg-ink-800 px-2 py-0.5 text-caption font-medium text-slate-300 hover:bg-ink-700 hover:text-slate-100 transition border border-ink-700 cursor-pointer"
            title="Copy UPI ID"
            aria-label="Copy UPI ID"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
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
            'flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-caption font-medium transition cursor-pointer',
            mode === 'phone'
              ? 'bg-primary text-slate-900 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-ink-700/50'
          )}
        >
          <Smartphone className="h-4 w-4 shrink-0" />
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
            'flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-caption font-medium transition cursor-pointer',
            mode === 'qr'
              ? 'bg-primary text-slate-900 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-ink-700/50'
          )}
        >
          <QrCode className="h-4 w-4 shrink-0" />
          <span>Scan QR Code</span>
        </button>
      </div>

      {/* Mode 1: Pay on this phone */}
      {mode === 'phone' && (
        <div id="phone-panel" role="tabpanel" aria-labelledby={phoneTabId} className="w-full space-y-4 pt-1">
          {!isMobile && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left">
              <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-caption text-amber-200">
                <span>Direct app pay works best on mobile phones with UPI apps installed. If on a computer, you can </span>
                <button
                  type="button"
                  onClick={() => setMode('qr')}
                  className="underline font-semibold hover:text-amber-100 cursor-pointer"
                >
                  Scan the QR code
                </button>
                <span> instead.</span>
              </div>
            </div>
          )}

          {/* Dedicated app button when token verification has a preselected app */}
          {payment.tokenVerificationEnabled && payment.app && (
            <div className="space-y-2">
              <a
                href={getAppSpecificUri(upiUri, payment.app)}
                onClick={handleAppClick}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-primary/90 active:scale-[0.98]"
              >
                <Smartphone className="h-4 w-4" />
                <span>Pay with {payment.appLabel || 'UPI App'}</span>
                <ExternalLink className="h-4 w-4 opacity-75" />
              </a>
              <p className="text-caption text-slate-400">
                Tap to launch {payment.appLabel || 'your chosen app'} with amount and payee prefilled.
              </p>
            </div>
          )}

          {/* Ordinary Flow / Universal intent chooser */}
          {(!payment.tokenVerificationEnabled || !payment.app) && (
            <div className="space-y-3">
              <a
                href={upiUri}
                onClick={handleAppClick}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-primary/90 active:scale-[0.98]"
              >
                <Smartphone className="h-4 w-4" />
                <span>Pay via any UPI App</span>
                <ExternalLink className="h-4 w-4 opacity-75" />
              </a>

              {/* Popular UPI App Shortcuts */}
              <div className="space-y-1.5 pt-1">
                <p className="text-caption text-slate-400">Or tap your preferred app directly:</p>
                <div className="grid grid-cols-2 gap-2">
                  {POPULAR_UPI_APPS.map((app) => (
                    <a
                      key={app.key}
                      href={getAppSpecificUri(upiUri, app.key)}
                      onClick={handleAppClick}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-caption font-medium transition active:scale-[0.98]',
                        app.colorClass,
                        app.borderClass,
                        app.textClass
                      )}
                    >
                      <span>{app.label}</span>
                      <ArrowRight className="h-3 w-3 opacity-60" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Token display box under token verification */}
          {payment.tokenVerificationEnabled && (
            <div className="w-full rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-left">
              <p className="text-overline uppercase text-slate-400">
                Your payment token{payment.appLabel ? ` • ${payment.appLabel}` : ''}
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-slate-100">
                {customerName ? `${customerName}: ${payment.token}` : payment.token}
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 text-caption text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Secure 1-tap payment via official UPI intent</span>
          </div>
        </div>
      )}

      {/* Mode 2: Scan QR Code */}
      {mode === 'qr' && (
        <div id="qr-panel" role="tabpanel" aria-labelledby={qrTabId} className="w-full space-y-3 pt-1 flex flex-col items-center">
          <div className="relative rounded-xl border border-ink-700 bg-white p-3 shadow-inner">
            <img
              src={payment.qrDataUri}
              alt="Scan to pay via UPI"
              className="h-52 w-52 object-contain"
            />
          </div>

          <p className="text-body-sm text-slate-300">
            Scan with any UPI app to pay from another device.
          </p>

          {/* Token display under verification */}
          {payment.tokenVerificationEnabled && (
            <div className="w-full rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-left">
              <p className="text-overline uppercase text-slate-400">
                Your payment token{payment.appLabel ? ` • ${payment.appLabel}` : ''}
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-slate-100">
                {customerName ? `${customerName}: ${payment.token}` : payment.token}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action Footer: Confirming / Mark Payment Done */}
      <div className="w-full pt-2 border-t border-ink-800 space-y-2">
        {confirming ? (
          <div className="flex items-center justify-center gap-2 text-body-sm text-slate-400 py-1">
            <Spinner className="h-4 w-4" />
            <span>Confirming your payment…</span>
          </div>
        ) : showMarkDone ? (
          <Button onClick={onMarkDone} className="w-full">
            Mark payment done
          </Button>
        ) : (
          <div className="text-caption text-slate-400">
            {appLaunched
              ? 'Complete the payment in your UPI app, then tap Mark payment done.'
              : mode === 'phone'
                ? 'Open your UPI app to complete payment.'
                : 'Scan the QR and pay the amount above.'}
          </div>
        )}

        <p className="text-caption text-slate-400">
          {confirming
            ? 'Confirming payment — you will be redirected to your order details shortly.'
            : showMarkDone
              ? payment.tokenVerificationEnabled
                ? "Once you've paid, tap Mark payment done to proceed."
                : "Once you've paid, tap Mark payment done."
              : mode === 'phone'
                ? 'Opening your UPI app does not finalize the order. Return here to mark payment done.'
                : 'Scan the QR with any UPI app to pay.'}
        </p>
      </div>
    </div>
  );
}
