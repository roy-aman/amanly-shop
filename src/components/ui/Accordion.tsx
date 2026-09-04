import type { ReactNode } from 'react';
import * as RadixAccordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

/**
 * Accordion — Radix-backed (keyboard nav, ARIA, single/multiple modes).
 *
 * <Accordion type="single" collapsible>
 *   <AccordionItem value="a" title="Shipping">…</AccordionItem>
 *   <AccordionItem value="b" title="Returns">…</AccordionItem>
 * </Accordion>
 */
type SingleProps = {
  type?: 'single';
  collapsible?: boolean;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
};
type MultipleProps = {
  type: 'multiple';
  defaultValue?: string[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
  className?: string;
  children: ReactNode;
};

export function Accordion(props: SingleProps | MultipleProps) {
  const { className, children } = props;
  return (
    // Radix's Root prop types are a discriminated union on `type`; the runtime
    // forwards whatever caller passes. Cast keeps the friendly wrapper types.
    <RadixAccordion.Root
      {...(props as RadixAccordion.AccordionSingleProps)}
      className={cn('divide-y divide-ink-700 rounded-2xl border border-ink-700/70', className)}
    >
      {children}
    </RadixAccordion.Root>
  );
}

export function AccordionItem({
  value,
  title,
  children,
  className,
}: {
  value: string;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixAccordion.Item value={value} className={cn('overflow-hidden first:rounded-t-2xl last:rounded-b-2xl', className)}>
      <RadixAccordion.Header className="flex">
        <RadixAccordion.Trigger
          className={cn(
            'group flex flex-1 items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-slate-200 transition',
            'hover:bg-ink-800/60',
            'focus:outline-none focus-visible:outline-none',
          )}
        >
          {title}
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </RadixAccordion.Trigger>
      </RadixAccordion.Header>
      <RadixAccordion.Content className="px-5 pb-4 text-sm text-slate-400">{children}</RadixAccordion.Content>
    </RadixAccordion.Item>
  );
}
