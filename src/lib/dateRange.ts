/* Date-range helpers for the admin stats pages (WP-3.1).
   The stats API takes inclusive yyyy-MM-dd `from`/`to` days and defaults to the
   trailing 30 days ending today (UTC) — these helpers mirror that convention. */

export interface RangePreset {
  days: number;
  label: string;
}

export const RANGE_PRESETS: RangePreset[] = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

/** yyyy-MM-dd in UTC (matches the backend's LocalDate.now(UTC) semantics). */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Inclusive {from,to} for the trailing `days` window ending today (UTC). */
export function trailingRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  return { from: isoDay(from), to: isoDay(to) };
}
