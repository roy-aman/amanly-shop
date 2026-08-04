import type { ReactNode } from 'react';

// ── Empty state ───────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    // No dashed box. An empty state is an absence, and drawing a container
    // around nothing draws attention to the nothing; whitespace and a centred
    // message read as calm rather than broken.
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-5 text-slate-500">{icon}</div>}
      <h3 className="text-h4 text-slate-100">{title}</h3>
      {message && <p className="mt-2 max-w-sm text-body-sm text-slate-400">{message}</p>}
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}
