import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';

// ── Modal ─────────────────────────────────────────────────────────────
// NOTE: intentionally kept as the original hand-rolled dialog (not migrated to
// Radix) — ~6 pages depend on its exact props/markup/behaviour and a swap risks
// visual/behaviour regressions with no functional gain for those call sites.
// New keyboard-hard dialogs (ConfirmDialog, Drawer) are Radix-backed instead.
// Only change vs. the pre-split version: the magic `z-[90]` is now the
// `z-modal` token (same value, per design-system.md §4).
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className={cn('relative z-10 w-full animate-fade-in rounded-2xl border border-ink-700 bg-ink-900 shadow-lift', width)}>
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:text-slate-200" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-700 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
