import { type CSSProperties } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * ThemedChart — thin recharts wrappers pre-styled from the design tokens
 * (dark surfaces, slate axes, gold-led series palette). Use these instead of
 * re-specifying axis/grid/tooltip colours on every dashboard chart.
 *
 * NOTE: recharts detects its children by component type, so a themed <Tooltip>
 * can't be wrapped in a custom component and still register. These wrappers
 * therefore render the real recharts elements internally; for fully bespoke
 * charts, import recharts directly and reuse the exported `chartTheme` styles.
 */

// Token-matched hexes (recharts renders SVG, so it needs raw colours, not
// Tailwind classes). Keep in sync with tailwind.config.js.
export const CHART_COLORS = ['#e0b040', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa'] as const;

export const chartTheme = {
  grid: '#262b3a', // ink-700
  axis: '#94a3b8', // slate-400
  tooltipContentStyle: {
    background: '#12141c', // ink-900
    border: '1px solid #262b3a',
    borderRadius: '0.75rem',
    color: '#e2e8f0',
    fontSize: 12,
  } satisfies CSSProperties,
  tooltipLabelStyle: { color: '#94a3b8', marginBottom: 4 } satisfies CSSProperties,
  tooltipItemStyle: { color: '#e2e8f0' } satisfies CSSProperties,
};

export interface ChartSeries {
  key: string;
  name?: string;
  color?: string;
}

interface BaseChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  series: ChartSeries[];
  height?: number;
  className?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  xTickFormatter?: (value: unknown) => string;
  yTickFormatter?: (value: unknown) => string;
  valueFormatter?: (value: number | string) => string;
}

const AXIS_TICK = { fill: chartTheme.axis, fontSize: 11 };

function SharedAxes({ xKey, xTickFormatter, yTickFormatter }: Pick<BaseChartProps, 'xKey' | 'xTickFormatter' | 'yTickFormatter'>) {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
      <XAxis dataKey={xKey} tick={AXIS_TICK} stroke={chartTheme.grid} tickFormatter={xTickFormatter as never} />
      <YAxis tick={AXIS_TICK} stroke={chartTheme.grid} tickFormatter={yTickFormatter as never} allowDecimals={false} />
    </>
  );
}

function themedTooltip(valueFormatter?: BaseChartProps['valueFormatter']) {
  return (
    <Tooltip
      contentStyle={chartTheme.tooltipContentStyle}
      labelStyle={chartTheme.tooltipLabelStyle}
      itemStyle={chartTheme.tooltipItemStyle}
      cursor={{ fill: 'rgba(255,255,255,0.04)', stroke: chartTheme.grid }}
      formatter={valueFormatter ? (v: number | string) => valueFormatter(v) : undefined}
    />
  );
}

export function ThemedAreaChart({
  data,
  xKey,
  series,
  height = 256,
  className,
  showGrid = true,
  showLegend = false,
  xTickFormatter,
  yTickFormatter,
  valueFormatter,
}: BaseChartProps) {
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            {series.map((s, i) => {
              const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
              return (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          {showGrid && <SharedAxes xKey={xKey} xTickFormatter={xTickFormatter} yTickFormatter={yTickFormatter} />}
          {themedTooltip(valueFormatter)}
          {showLegend && <Legend wrapperStyle={{ fontSize: 12, color: chartTheme.axis }} />}
          {series.map((s, i) => {
            const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name ?? s.key}
                stroke={color}
                strokeWidth={2}
                fill={`url(#fill-${s.key})`}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ThemedLineChart({
  data,
  xKey,
  series,
  height = 256,
  className,
  showGrid = true,
  showLegend = false,
  xTickFormatter,
  yTickFormatter,
  valueFormatter,
}: BaseChartProps) {
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          {showGrid && <SharedAxes xKey={xKey} xTickFormatter={xTickFormatter} yTickFormatter={yTickFormatter} />}
          {themedTooltip(valueFormatter)}
          {showLegend && <Legend wrapperStyle={{ fontSize: 12, color: chartTheme.axis }} />}
          {series.map((s, i) => {
            const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name ?? s.key}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ThemedBarChart({
  data,
  xKey,
  series,
  height = 256,
  className,
  showGrid = true,
  showLegend = false,
  xTickFormatter,
  yTickFormatter,
  valueFormatter,
}: BaseChartProps) {
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          {showGrid && <SharedAxes xKey={xKey} xTickFormatter={xTickFormatter} yTickFormatter={yTickFormatter} />}
          {themedTooltip(valueFormatter)}
          {showLegend && <Legend wrapperStyle={{ fontSize: 12, color: chartTheme.axis }} />}
          {series.map((s, i) => {
            const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
            return <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={color} radius={[4, 4, 0, 0]} />;
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
