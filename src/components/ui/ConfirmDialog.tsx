import type { ReactNode } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Button } from './Button';
import { cn } from './cn';

/**
 * ConfirmDialog — Radix AlertDialog (focus trap, Escape, ARIA alertdialog,
 * focus lands on the default action). Use for destructive/irreversible
 * confirmations instead of hand-rolling a Modal + buttons.
 *
 * Controlled:
 *   <ConfirmDialog open={open} onOpenChange={setOpen} title="Delete?"
 *     description="This cannot be undone." destructive confirmLabel="Delete"
 *     onConfirm={doDelete} loading={pending} />
 *
 * With a trigger (uncontrolled open):
 *   <ConfirmDialog trigger={<Button variant="danger">Delete</Button>} … />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-modal bg-black/60 backdrop-blur-sm animate-fade-in" />
        <AlertDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-modal w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2',
            'animate-fade-in rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-lift focus:outline-none',
          )}
        >
          <AlertDialog.Title className="text-h4 text-slate-100">{title}</AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-2 text-sm text-slate-400">{description}</AlertDialog.Description>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={loading}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            {/* Keep the dialog open while the async action runs; the caller closes
                it via `onOpenChange` once settled. Don't auto-close on click. */}
            <Button
              variant={destructive ? 'danger' : 'primary'}
              loading={loading}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
