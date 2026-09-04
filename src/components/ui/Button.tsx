import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

// ── Button ────────────────────────────────────────────────────────────
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // `primary` resolves through the --primary variables: black on the
  // storefront, gold in the admin console. See index.css.
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover font-medium shadow-sm hover:shadow-md',
  secondary: 'bg-ink-700 text-slate-100 hover:bg-ink-600 border border-ink-600',
  outline: 'border border-ink-600 text-slate-200 hover:bg-ink-800 hover:border-slate-100',
  ghost: 'text-slate-300 hover:bg-ink-800 hover:text-slate-100',
  // danger-700 rather than -600: white on #e11d48 is 4.1:1 and misses AA.
  danger: 'bg-danger-700 text-white hover:bg-danger-600 font-semibold shadow-sm hover:shadow-md',
};
export const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3.5 text-xs',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
  // The marketing CTA size. Uppercase + tracked by definition — reserved for
  // hero and section calls-to-action, never for dense UI.
  xl: 'h-14 px-9 text-sm font-semibold uppercase tracking-[0.12em]',
};

/**
 * Shared shell. Pill rather than `rounded-lg`: a fully-round button is the one
 * shape a rounded-rectangle interface never produces by accident, so it reads
 * as deliberate — and it is the house style of the retail brands Amanly sits
 * beside.
 *
 * `active:scale` is the point of this recipe. A button that only changes colour
 * on press feels like a link; one that gives under the pointer feels like a
 * control. Scale is compositor-only, so it costs nothing per frame, and the
 * global reduced-motion rule collapses the transition for anyone who asked.
 */
const BUTTON_BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-full ' +
  'transition duration-200 ease-emphasized active:scale-[0.97] ' +
  'focus:outline-none focus-visible:outline-none';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        BUTTON_BASE,
        // A disabled control must not pretend to be pressable.
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:active:scale-100',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

interface LinkButtonProps {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}
export function LinkButton({ to, variant = 'primary', size = 'md', fullWidth, className, children }: LinkButtonProps) {
  return (
    <Link
      to={to}
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {children}
    </Link>
  );
}
