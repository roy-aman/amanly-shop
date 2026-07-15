import type { ReactNode } from 'react';
import { Stat, type StatDelta } from '@/components/ui';

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * KPI tile for the admin stats pages: a `Stat` whose delta is driven by the
 * backend `changePct`. When `changePct` is null (the previous period was zero)
 * no trend badge is shown and the hint carries an explicit "—" so the period
 * reads as unknown, never as 0. `positiveIsGood` defaults to true (up = good).
 */
export default function MetricTile({
  label,
  value,
  icon,
  changePct,
  positiveIsGood = true,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  changePct: number | null;
  positiveIsGood?: boolean;
}) {
  const delta: StatDelta | undefined =
    changePct == null ? undefined : { value: round1(changePct), positiveIsGood, label: 'vs. previous period' };
  return (
    <Stat
      label={label}
      value={value}
      icon={icon}
      delta={delta}
      hint={changePct == null ? '— vs. previous period' : undefined}
    />
  );
}
