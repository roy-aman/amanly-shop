import type { ReactNode } from 'react';
import { cn } from '@/components/ui';

/**
 * The shared vocabulary for a receipt: an order the shopper is about to place, and one they placed.
 *
 * <p><b>Why a document, not a dashboard.</b> Both pages previously read as admin screens — a table
 * with column headers for four items, figures spread across a wide grid. An order is a receipt, and
 * a receipt is a narrow stack of labelled blocks you scan top to bottom: what I bought, what it
 * cost, where it is going, when it arrives. Every food and grocery app converges on that shape
 * because it is the shape of the paper slip it replaces.
 *
 * <p>Checkout and order detail share these pieces on purpose. The summary a shopper approves and
 * the summary they are shown afterwards should be recognisably the same object; when the second one
 * is laid out differently, people re-read it looking for what changed.
 */

/** A labelled block. The label is quiet and small — it names the block without competing with it. */
export function SummarySection({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  /** Optional control on the label row, e.g. "Change" on a checkout step. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-ink-700 bg-ink-900', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-5 py-3.5">
        <h2 className="text-overline uppercase tracking-[0.14em] text-slate-500">{title}</h2>
        {action}
      </div>
      <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * Label on the left, value on the right. `dt`/`dd` rather than two spans, so the pairing survives
 * being read aloud — the whole point of these blocks is that each line is a fact about the order.
 */
export function InfoRow({
  label,
  children,
  emphasis = false,
  className,
}: {
  /** Usually a word; a node when the label itself carries meaning, e.g. a green discount tag. */
  label: ReactNode;
  children: ReactNode;
  /** The one row that is the answer — the payable total. Exactly one per block, or none is. */
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4',
        emphasis ? 'pt-3.5 pb-1' : 'py-2.5',
        className,
      )}
    >
      <dt className={cn('shrink-0 text-body-sm', emphasis ? 'font-semibold text-slate-200' : 'text-slate-400')}>
        {label}
      </dt>
      <dd
        className={cn(
          'min-w-0 text-right tabular-nums',
          emphasis ? 'text-h3 font-bold text-slate-100' : 'text-body-sm font-medium text-slate-100',
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/**
 * The square at the start of a line: the product's photograph, or its initials when there is none.
 *
 * <p>The picture is read live from the product rather than snapshotted onto the line. Name, SKU and
 * price ARE snapshotted, so a catalogue edit can never rewrite what someone was charged — but a
 * thumbnail is decoration, no money depends on it, and a snapshotted URL would only guarantee that
 * old orders eventually point at deleted images. A product removed since placement simply sends no
 * URL, and the line falls back to its monogram.
 *
 * <p>The monogram is a real state, not a loading shim: it keeps the list's rhythm for a merchant who
 * has not uploaded photos yet, and reads as considered rather than broken.
 */
export function ItemThumb({
  name,
  imageUrl,
  className,
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div
      className={cn(
        'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink-850',
        'text-body-sm font-semibold tracking-wide text-slate-400',
        className,
      )}
      // Empty alt on the image and aria-hidden on the monogram, for one reason: the product name is
      // the next thing in the row as real text, so either would say it twice to a screen reader.
      aria-hidden={!imageUrl}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

/**
 * One purchased line: thumbnail, what it is, how many, what it cost.
 *
 * <p>Quantity sits under the name as plain words rather than in a column of its own. "2 × ₹450" on
 * its own line is how a receipt states it, and it removes the header row a four-column table needed
 * to be legible — a table's overhead only pays off past a dozen rows, and an order is rarely that.
 */
export function OrderLine({
  name,
  meta,
  imageUrl,
  quantity,
  unitPrice,
  subtotal,
}: {
  name: string;
  /** Variant options or SKU — whatever identifies which one of these it is. */
  meta?: string | null;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}) {
  return (
    <div className="flex items-start gap-3.5 py-3.5">
      <ItemThumb name={name} imageUrl={imageUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-sm font-medium text-slate-100">{name}</p>
        {meta && <p className="mt-0.5 truncate text-caption text-slate-400">{meta}</p>}
        <p className="mt-1 text-caption text-slate-500">
          {quantity} × {unitPrice}
        </p>
      </div>
      <span className="shrink-0 text-body-sm font-semibold tabular-nums text-slate-100">
        {subtotal}
      </span>
    </div>
  );
}

/** Hairlines between children, so a block of lines needs no border utility at every call site. */
export function Divided({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('divide-y divide-ink-700', className)}>{children}</div>;
}
