/* Formatting helpers shared across the app. */

export function money(amount: number | null | undefined, currency = 'USD'): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));
  } catch {
    // Unknown currency code — fall back to a plain number with the code appended.
    return `${Number(amount).toFixed(2)} ${currency}`;
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Human-readable "2 hours ago" style relative time. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/**
 * What to call an order on screen.
 *
 * The order number is the reference a customer quotes on the phone and the one printed on their
 * confirmation email; eight characters of a UUID is neither, and matches nothing they hold. Orders
 * placed before numbering existed have none, so the short id stays as the fallback — keeping its
 * "#" so it still reads as a reference rather than as a fragment of something longer.
 *
 * Takes the shape rather than a named type so it serves both the summary rows and the full order.
 */
export function orderRef(order: { orderNumber?: string | null; id: string }): string {
  return order.orderNumber ?? `#${order.id.slice(0, 8)}`;
}
