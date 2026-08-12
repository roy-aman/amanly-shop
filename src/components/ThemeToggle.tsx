import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '@/context/ThemeContext';
import {
  cn,
  DropdownMenu,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  // Worth its own entry rather than being merely the default: it is the only
  // setting that keeps following the machine, which is what someone whose OS
  // flips at sunset actually wants.
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * Appearance picker — three explicit states, not a two-way switch.
 *
 * A bare light/dark toggle cannot express "follow my machine", and once tapped
 * there is no way back to it. Three options cost one dropdown and mean the
 * setting can always be returned to where it started.
 *
 * Renders nothing on console routes: those hold dark deliberately (see
 * `useDarkTheme`), so a picker there would be a control that visibly does
 * nothing — worse than no control at all.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference, resolved, forcedByConsole } = useTheme();

  if (forcedByConsole) return null;

  const Icon = resolved === 'dark' ? Moon : Sun;
  const current = OPTIONS.find((o) => o.value === preference);

  return (
    <DropdownMenu
      trigger={
        <button
          type="button"
          className={className}
          // The label names the current setting, so a screen-reader user learns
          // the state without opening the menu.
          aria-label={`Appearance: ${current?.label ?? 'System'}`}
          title={`Appearance: ${current?.label ?? 'System'}`}
        >
          <Icon className="h-5 w-5" />
        </button>
      }
    >
      <DropdownMenuLabel>Appearance</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={preference}
        onValueChange={(v) => setPreference(v as ThemePreference)}
      >
        {OPTIONS.map((o) => (
          <DropdownMenuRadioItem key={o.value} value={o.value}>
            <o.icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            {o.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenu>
  );
}

/**
 * The same choice as a segmented control, for the mobile drawer — where a
 * dropdown inside an already-open panel is a second layer to dismiss.
 */
export function ThemeSegmented({ className }: { className?: string }) {
  const { preference, setPreference, forcedByConsole } = useTheme();

  if (forcedByConsole) return null;

  return (
    <div className={className}>
      <p className="text-overline uppercase text-slate-500">Appearance</p>
      <div
        role="radiogroup"
        aria-label="Appearance"
        className="mt-3 flex rounded-full border border-ink-700 bg-ink-850 p-1"
      >
        {OPTIONS.map((o) => {
          const active = preference === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPreference(o.value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-caption',
                'transition duration-200 ease-emphasized active:scale-95',
                active
                  ? 'bg-primary text-primary-fg shadow-sm'
                  : 'text-slate-400 hover:text-slate-100',
              )}
            >
              <o.icon className="h-3.5 w-3.5" aria-hidden />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
