import type { ReactNode } from 'react';
import { cn } from './cn';

// ── Badge ─────────────────────────────────────────────────────────────
// Tone → semantic-token map. Every tone resolves through theme-aware tokens,
// so the same "soft" recipe (tint fill, deep text, faint border) reads on both
// the light storefront and the dark console: the `-500` tints sit at low alpha
// and the `-300` text shade flips to a deep hue on light.
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
