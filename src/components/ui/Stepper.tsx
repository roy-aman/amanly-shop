import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { cn } from './cn';

export interface Step {
  label: string;
  description?: string;
}

/**
 * Stepper — horizontal progress indicator for multi-step flows (e.g. checkout:
 * Address → Payment → Review). `current` is the 0-based active step; earlier
 * steps render as complete. Display-only — the parent owns navigation/state.
 */
export function Stepper({ steps, current, className }: { steps: Step[]; current: number; className?: string }) {
  return (
    <ol className={cn('flex w-full items-center', className)} aria-label="Progress">
      {steps.map((step, i) => {
        const status = i < current ? 'complete' : i === current ? 'current' : 'upcoming';
        const isLast = i === steps.length - 1;
        return (
          <Fragment key={step.label}>
            <li className="flex min-w-0 items-center gap-3" aria-current={status === 'current' ? 'step' : undefined}>
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition',
                  status === 'complete' && 'border-gold-400 bg-gold-400 text-ink-950',
                  status === 'current' && 'border-gold-400 text-gold-300',
                  status === 'upcoming' && 'border-ink-600 text-slate-500',
                )}
              >
                {status === 'complete' ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    'block truncate text-sm font-medium',
                    status === 'upcoming' ? 'text-slate-500' : 'text-slate-200',
                  )}
                >
                  {step.label}
                </span>
                {step.description && <span className="block truncate text-xs text-slate-500">{step.description}</span>}
              </span>
            </li>
            {!isLast && (
              <span
                className={cn('mx-3 h-px flex-1 transition-colors', i < current ? 'bg-gold-400/60' : 'bg-ink-700')}
                aria-hidden
              />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}
