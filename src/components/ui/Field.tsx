import { forwardRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from './cn';

// ── Form fields ───────────────────────────────────────────────────────
interface FieldWrapProps {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}
export function Field({ label, error, hint, required, className, children }: FieldWrapProps) {
  return (
    <div className={className}>
      {label && (
        <label className="rc-label">
          {label} {required && <span className="text-danger-400">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger-400">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return <input ref={ref} className={cn('rc-input', invalid && 'border-danger-500 focus:border-danger-500', className)} {...rest} />;
  },
);

/**
 * Password input with a show/hide (eye) toggle. Drop-in replacement for <Input> on password
 * fields — owns its own `type`, so don't pass one. `tabIndex={-1}` keeps the toggle out of the
 * form's tab order so it never interrupts type-password-then-Enter.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { invalid?: boolean }>(
  function PasswordInput({ className, invalid, ...rest }, ref) {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={show ? 'text' : 'password'}
          className={cn('rc-input pr-10', invalid && 'border-danger-500 focus:border-danger-500', className)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
          title={show ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-slate-200"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return <textarea ref={ref} className={cn('rc-input min-h-[90px] resize-y', invalid && 'border-danger-500', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn('rc-input cursor-pointer', invalid && 'border-danger-500', className)} {...rest}>
        {children}
      </select>
    );
  },
);
