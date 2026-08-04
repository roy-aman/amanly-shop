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
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover font-medium',
  secondary: 'bg-ink-700 text-slate-100 hover:bg-ink-600 border border-ink-600',
  outline: 'border border-ink-600 text-slate-200 hover:bg-ink-800 hover:border-ink-500',
  ghost: 'text-slate-300 hover:bg-ink-800 hover:text-slate-100',
  // danger-700 rather than -600: white on #e11d48 is 4.1:1 and misses AA.
  danger: 'bg-danger-700 text-white hover:bg-danger-600 font-semibold',
};
export const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  // The marketing CTA size. Uppercase + tracked by definition — reserved for
  // hero and section calls-to-action, never for dense UI.
  xl: 'h-14 px-8 text-sm font-semibold uppercase tracking-[0.12em]',
};

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
        'inline-flex items-center justify-center gap-2 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60',
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
        'inline-flex items-center justify-center gap-2 rounded-lg transition',
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
