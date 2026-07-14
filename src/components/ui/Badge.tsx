import type { ReactNode } from 'react';
import { cn } from './cn';

// ── Badge ─────────────────────────────────────────────────────────────
// Tone → semantic-token map per design-system.md §1.4. The semantic scales
// (success/warning/danger/info) mirror the Tailwind emerald/amber/rose/sky
// values previously hard-coded here, so this is a zero-visual-change refactor;
// the public `tone` prop is unchanged. `purple` stays a `violet` literal (one
// use — SHIPPED — doesn't yet justify a token, per design-system.md §1.4).
export type Tone = 'gold' | 'green' | 'red' | 'blue' | 'gray' | 'amber' | 'purple';
const TONES: Record<Tone, string> = {
  gold: 'bg-gold-400/15 text-gold-300 border-gold-400/30',
  green: 'bg-success-500/15 text-success-300 border-success-500/30',
  red: 'bg-danger-500/15 text-danger-300 border-danger-500/30',
  blue: 'bg-info-500/15 text-info-300 border-info-500/30',
  amber: 'bg-warning-500/15 text-warning-300 border-warning-500/30',
  purple: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  gray: 'bg-ink-700 text-slate-300 border-ink-600',
};
export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', TONES[tone])}>
      {children}
    </span>
  );
}
