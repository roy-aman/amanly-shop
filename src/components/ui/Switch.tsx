import { cn } from './cn';

/**
 * Switch — an on/off control that reads as on or off at a glance.
 *
 * A checkbox says "is this ticked"; a switch says "is this running", which is
 * the question being asked wherever settings decide whether customers can see
 * something. The difference matters most in a list, where a row of ticks all
 * look alike and a row of switches reads as a state column.
 *
 * `role="switch"` with `aria-checked` rather than a styled checkbox: assistive
 * technology then announces "on"/"off" instead of "checked", which is the same
 * distinction the visuals are making.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Always required: the control names itself, since `Field` labels are not
   *  associated with what they sit above. */
  label: string;
  /** Shown beside the label where the consequence needs spelling out. */
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const knob = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5';
  const travel = size === 'sm' ? 'translate-x-4' : 'translate-x-5';

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border transition duration-200 ease-emphasized',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70',
        track,
        checked ? 'border-primary bg-primary' : 'border-ink-600 bg-ink-800',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'ml-0.5 inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ease-emphasized',
          knob,
          checked ? travel : 'translate-x-0',
        )}
      />
    </button>
  );

  if (!description && !label) return control;

  return (
    <div className={cn('flex items-start gap-3', className)}>
      {control}
      <div className="min-w-0">
        <span className="block text-body-sm font-medium text-slate-200">{label}</span>
        {description && <span className="block text-caption text-slate-500">{description}</span>}
      </div>
    </div>
  );
}
