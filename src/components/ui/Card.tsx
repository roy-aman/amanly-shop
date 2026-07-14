import type { ReactNode } from 'react';
import { cn } from './cn';

// ── Card ──────────────────────────────────────────────────────────────
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rc-card', className)}>{children}</div>;
}
