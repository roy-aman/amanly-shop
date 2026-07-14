import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/components/ui';

type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastApi {
  push: (kind: ToastKind, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let counter = 0;

// Semantic status colors from the design system (§1.4). Icon tint + a subtle
// left accent bar carry the meaning; the surface itself stays neutral `ink` so
// the text keeps its contrast.
const ICONS: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-success-400" />,
  error: <XCircle className="h-5 w-5 text-danger-400" />,
  info: <Info className="h-5 w-5 text-info-400" />,
  warning: <AlertTriangle className="h-5 w-5 text-warning-400" />,
};

const ACCENTS: Record<ToastKind, string> = {
  success: 'border-l-success-500',
  error: 'border-l-danger-500',
  info: 'border-l-info-500',
  warning: 'border-l-warning-500',
};

// Errors/warnings interrupt (assertive); success/info are polite status updates.
const ROLES: Record<ToastKind, 'alert' | 'status'> = {
  success: 'status',
  error: 'alert',
  info: 'status',
  warning: 'alert',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, kind, title, message }]);
      window.setTimeout(() => remove(id), 5000);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (t, m) => push('success', t, m),
      error: (t, m) => push('error', t, m),
      info: (t, m) => push('info', t, m),
      warning: (t, m) => push('warning', t, m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-toast flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-fade-in items-start gap-3 rounded-2xl border border-l-4 border-ink-700 bg-ink-850/95 p-4 shadow-lift backdrop-blur',
              ACCENTS[t.kind],
            )}
            role={ROLES[t.kind]}
          >
            <div className="mt-0.5 shrink-0">{ICONS[t.kind]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-semibold text-slate-100">{t.title}</p>
              {t.message && <p className="mt-0.5 text-body-sm text-slate-400">{t.message}</p>}
            </div>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 rounded p-0.5 text-slate-500 transition hover:text-slate-200"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
