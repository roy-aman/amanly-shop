import type { ReactNode } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from './cn';

/**
 * Tooltip — Radix-backed (keyboard-focus + hover triggered, Escape-dismiss,
 * ARIA-described). Wrap any focusable element as the trigger.
 *
 * <Tooltip content="Copy link"><button>…</button></Tooltip>
 *
 * A single <TooltipProvider> should wrap the app (or a subtree) to share the
 * hover-delay timer; this component nests its own provider so it also works
 * standalone.
 */
export function TooltipProvider({ children, delayDuration = 200 }: { children: ReactNode; delayDuration?: number }) {
  return <RadixTooltip.Provider delayDuration={delayDuration}>{children}</RadixTooltip.Provider>;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  sideOffset = 6,
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  className?: string;
}) {
  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={sideOffset}
            className={cn(
              'z-tooltip max-w-xs animate-fade-in rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs text-slate-200 shadow-lift',
              className,
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-ink-850" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
