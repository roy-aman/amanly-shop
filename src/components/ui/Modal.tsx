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
//
// Tall dialogs: the panel caps at the viewport and scrolls its own body, with
// the title row and the buttons pinned. Before this it grew unbounded and a long
// form (the service editor is a dozen fields) pushed its own heading off the top
// of the screen with no way to scroll back to it — `items-center` overflows a
// flex child in BOTH directions, and the half above the scroll origin is simply
// unreachable. `my-auto` is what centres a short dialog now: auto margins take
// the free space when there is any and yield when there is none, which is the
// behaviour `items-center` only pretends to have.
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  // Set false for a flow with a real consequence attached to closing (e.g. cancelling an order)
  // that must not be triggered by an accidental backdrop click — only the explicit X.
  dismissible?: boolean;
}) {
  if (!open) return null;
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <div
      className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={dismissible ? onClose : undefined}
    >
      <div className="absolute inset-0" aria-hidden />
      {/* Settles in place rather than dropping in — a dialog that scales up from
          the centre reads as the page focusing, not as a new page arriving. */}
      <div
        className={cn(
          'relative z-10 my-auto flex max-h-[calc(100vh-2rem)] w-full flex-col animate-scale-in rounded-2xl border border-ink-700 bg-ink-900 shadow-lift',
          width,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ink-700 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 transition duration-200 ease-emphasized hover:bg-ink-800 hover:text-slate-200 active:scale-90"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* The only part that scrolls, so Save and Cancel stay on screen however
            long the form is. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-ink-700 px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
