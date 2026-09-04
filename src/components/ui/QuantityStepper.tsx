import { Minus, Plus } from 'lucide-react';
import { cn } from './cn';

/**
 * QuantityStepper — accessible −/＋ quantity control with a clamped numeric
 * input. Controlled: pass `value` + `onChange`. Respects `min`/`max`/`step`
 * and a `disabled` (e.g. while a cart mutation is in flight).
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  step = 1,
  disabled = false,
  size = 'md',
  className,
  'aria-label': ariaLabel = 'Quantity',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const set = (n: number) => {
    const c = clamp(n);
    if (c !== value) onChange(c);
  };
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const btn =
    'flex shrink-0 items-center justify-center text-slate-300 transition duration-200 ease-emphasized ' +
    'hover:bg-ink-800 hover:text-slate-100 active:scale-90 ' +
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 disabled:hover:bg-transparent';

  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded-full border border-ink-600 bg-ink-850',
        'transition-colors duration-200 focus-within:border-slate-100',
        className,
      )}
    >
      <button
        type="button"
        className={cn(btn, dim)}
        onClick={() => set(value - step)}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) set(n);
        }}
        className={cn(
          'w-12 border-x border-ink-600 bg-transparent text-center text-sm font-medium text-slate-100',
          'focus:outline-none focus-visible:outline-none',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          size === 'sm' ? 'h-8' : 'h-10',
        )}
      />
      <button
        type="button"
        className={cn(btn, dim)}
        onClick={() => set(value + step)}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
