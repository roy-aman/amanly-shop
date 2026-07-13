import type { ReactNode } from 'react';
import { cn } from '@/components/ui';

type Tone = 'gold' | 'green' | 'blue' | 'rose' | 'violet' | 'slate';

const TONES: Record<Tone, string> = {
  gold: 'text-gold-300 bg-gold-400/10 border-gold-400/20',
  green: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  blue: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  rose: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
  violet: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
  slate: 'text-slate-300 bg-ink-800 border-ink-600',
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  tone?: Tone;
}

/** Compact KPI tile used across the admin dashboard & reports. */
export default function StatCard({ label, value, icon, hint, tone = 'slate' }: StatCardProps) {
  return (
    <div className="rc-card flex items-start gap-4 p-5">
      {icon && (
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', TONES[tone])}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-100">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
