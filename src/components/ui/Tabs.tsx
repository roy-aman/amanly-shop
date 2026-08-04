import type { ReactNode } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from './cn';

/**
 * Tabs — Radix-backed (roving-focus, arrow-key navigable, ARIA-complete).
 *
 * <Tabs defaultValue="a">
 *   <TabsList>
 *     <TabsTrigger value="a">First</TabsTrigger>
 *     <TabsTrigger value="b">Second</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="a">…</TabsContent>
 *   <TabsContent value="b">…</TabsContent>
 * </Tabs>
 */
export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
}
export function Tabs({ value, defaultValue, onValueChange, className, children }: TabsProps) {
  return (
    <RadixTabs.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} className={className}>
      {children}
    </RadixTabs.Root>
  );
}

export function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <RadixTabs.List
      className={cn('flex items-center gap-1 border-b border-ink-700', className)}
      aria-label="Tabs"
    >
      {children}
    </RadixTabs.List>
  );
}

export function TabsTrigger({ value, className, children }: { value: string; className?: string; children: ReactNode }) {
  return (
    <RadixTabs.Trigger
      value={value}
      className={cn(
        'relative -mb-px inline-flex items-center gap-2 border-b-2 border-transparent px-3.5 py-2.5 text-sm font-medium text-slate-400 transition',
        'hover:text-slate-200',
        // Selection rides the primary token: an ink underline on the storefront,
        // gold in the console — a selected tab is state, and on white gold is not
        // a state anyone can see.
        'data-[state=active]:border-primary data-[state=active]:text-slate-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 rounded-t',
        className,
      )}
    >
      {children}
    </RadixTabs.Trigger>
  );
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children: ReactNode }) {
  return (
    <RadixTabs.Content
      value={value}
      className={cn(
        'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 rounded',
        className,
      )}
    >
      {children}
    </RadixTabs.Content>
  );
}
