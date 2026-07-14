import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { cn } from './cn';

/**
 * DropdownMenu — Radix-backed (focus trap, arrow-key nav, typeahead, Escape,
 * outside-click, ARIA menu semantics). Portalled and themed with the popover
 * elevation/z-index tokens.
 *
 * <DropdownMenu trigger={<Button>Actions</Button>}>
 *   <DropdownMenuItem onSelect={…}>Edit</DropdownMenuItem>
 *   <DropdownMenuSeparator />
 *   <DropdownMenuItem destructive onSelect={…}>Delete</DropdownMenuItem>
 * </DropdownMenu>
 */
export function DropdownMenu({
  trigger,
  children,
  align = 'end',
  sideOffset = 6,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}) {
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content
          align={align}
          sideOffset={sideOffset}
          className={cn(
            'z-popover min-w-[10rem] animate-fade-in rounded-xl border border-ink-700 bg-ink-900 p-1.5 shadow-lift',
          )}
        >
          {children}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}

const ITEM_BASE =
  'flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-ink-800';

export function DropdownMenuItem({
  children,
  destructive,
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixMenu.Item> & { destructive?: boolean }) {
  return (
    <RadixMenu.Item
      className={cn(ITEM_BASE, destructive ? 'text-danger-300 data-[highlighted]:text-danger-200' : 'text-slate-200', className)}
      {...rest}
    >
      {children}
    </RadixMenu.Item>
  );
}

export function DropdownMenuLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <RadixMenu.Label className={cn('px-2.5 py-1.5 text-overline uppercase text-slate-500', className)}>{children}</RadixMenu.Label>;
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <RadixMenu.Separator className={cn('my-1 h-px bg-ink-700', className)} />;
}

export function DropdownMenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
  className,
}: {
  children: ReactNode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <RadixMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(ITEM_BASE, 'relative pl-8 text-slate-200', className)}
    >
      <RadixMenu.ItemIndicator className="absolute left-2.5">
        <Check className="h-4 w-4 text-gold-300" />
      </RadixMenu.ItemIndicator>
      {children}
    </RadixMenu.CheckboxItem>
  );
}
