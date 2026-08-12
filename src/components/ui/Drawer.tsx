import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from './cn';

/**
 * Drawer / Sheet — off-canvas panel built on Radix Dialog (focus trap, Escape,
 * scroll-lock, outside-click, ARIA dialog semantics). Slides in from any edge.
 * Used by WP-1.3 for the mobile nav drawer and the slide-out mini-cart.
 *
 * <Drawer open={open} onOpenChange={setOpen} side="right" title="Cart">…</Drawer>
 */
export type DrawerSide = 'left' | 'right' | 'top' | 'bottom';

// Position + the entrance that matches it. A drawer must arrive from the edge
// it is anchored to; a shared fade-up reads as a card landing on the page
// rather than a panel sliding in from off-screen.
const SIDE_CLASSES: Record<DrawerSide, string> = {
  left: 'inset-y-0 left-0 h-full w-[min(22rem,90vw)] border-r animate-slide-in-left',
  right: 'inset-y-0 right-0 h-full w-[min(22rem,90vw)] border-l animate-slide-in-right',
  top: 'inset-x-0 top-0 w-full max-h-[85vh] border-b animate-slide-in-top',
  bottom: 'inset-x-0 bottom-0 w-full max-h-[85vh] border-t animate-slide-in-bottom',
};

export function Drawer({
  open,
  onOpenChange,
  side = 'right',
  title,
  description,
  children,
  footer,
  className,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: DrawerSide;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-drawer bg-black/60 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content
          className={cn(
            // Entrance comes from SIDE_CLASSES — see the note there.
            'fixed z-drawer flex flex-col border-ink-700 bg-ink-900 shadow-lift focus:outline-none',
            SIDE_CLASSES[side],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-ink-700 px-5 py-4">
            <div className="min-w-0">
              {/* Radix requires a Title for a11y; render a visually-hidden one when omitted. */}
              <Dialog.Title className={cn('text-h4 text-slate-100', !title && 'sr-only')}>{title ?? 'Panel'}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-sm text-slate-400">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              className="z-overlay shrink-0 rounded-full p-1.5 text-slate-400 transition duration-200 ease-emphasized hover:bg-ink-800 hover:text-slate-100 active:scale-90"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="border-t border-ink-700 px-5 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Escape hatch for building fully custom drawer bodies while reusing the shell. */
export const DrawerClose = Dialog.Close;
export const DrawerTrigger = Dialog.Trigger;
