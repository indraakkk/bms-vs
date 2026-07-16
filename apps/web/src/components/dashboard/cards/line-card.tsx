import type { CardConfig, QueryResponse } from "@bms/contract";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_GRID,
  CHART_MONO,
  CHART_TICK,
  seriesColor,
} from "@/components/dashboard/cards/chart-colors";
import {
  formatCompact,
  formatHourUtc,
  formatNumber,
  formatTimestampUtc,
  pivotSeries,
} from "@/components/dashboard/cards/chart-utils";

const TOOLTIP_STYLE: React.CSSProperties = {
  fontSize: 12,
  borderRadius: 10,
  background: "var(--popover)",
  border: "1px solid var(--border-strong)",
  color: "var(--popover-foreground)",
  boxShadow: "0 16px 40px -12px rgba(0,0,0,.4)",
};

/** The mock's live-reading affordance: a pinging halo on each series'
 *  final point. Rendered via Recharts' function-form `dot`. */
function endDot(color: string, lastIndex: number) {
  return function EndDot(props: {
    key?: string;
    cx?: number;
    cy?: number;
    index?: number;
  }): React.ReactElement<SVGElement> {
    const { key, cx, cy, index } = props;
    if (index !== lastIndex || cx == null || cy == null) return <g key={key} />;
    return (
      <g key={key}>
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill={color}
          opacity={0.28}
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            animation: "ping-dot 1.9s ease-out infinite",
          }}
        />
        <circle cx={cx} cy={cy} r={3} fill={color} stroke="var(--card)" strokeWidth={1.5} />
      </g>
    );
  };
}

export function LineCard({
  data,
}: {
  config: Extract<CardConfig, { cardType: "line" }>;
  data: QueryResponse;
}) {
  const { data: pivoted, seriesKeys } = pivotSeries(data.rows);

  // Label roughly 6 hourly buckets, like the mock's step = ceil(n/6).
  const tickInterval = Math.max(0, Math.ceil(pivoted.length / 6) - 1);

  const lastIndexOf = (key: string) => {
    for (let i = pivoted.length - 1; i >= 0; i--) {
      if (pivoted[i][key] != null) return i;
    }
    return -1;
  };

  const chart = (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={pivoted} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART_GRID} />
        <XAxis
          dataKey="x"
          tickFormatter={formatHourUtc}
          tick={{ fontSize: 8.5, fill: CHART_TICK, fontFamily: CHART_MONO }}
          axisLine={false}
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis
          tick={{ fontSize: 8.5, fill: CHART_TICK, fontFamily: CHART_MONO }}
          axisLine={false}
          tickLine={false}
          width={34}
          tickCount={3}
          tickFormatter={formatCompact}
        />
        <Tooltip
          labelFormatter={formatTimestampUtc}
          formatter={(value: number) => formatNumber(value)}
          contentStyle={TOOLTIP_STYLE}
        />
        {/* Soft area wash under the first series only, per the mock. */}
        <Area
          dataKey={seriesKeys[0]}
          fill={seriesColor(0)}
          fillOpacity={0.09}
          stroke="none"
          connectNulls
          tooltipType="none"
          legendType="none"
          isAnimationActive={false}
        />
        {seriesKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={key}
            stroke={seriesColor(i)}
            strokeWidth={2}
            strokeLinecap="round"
            dot={endDot(seriesColor(i), lastIndexOf(key))}
            connectNulls
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );

  if (seriesKeys.length <= 1) return chart;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-0.5 flex flex-wrap gap-x-3 gap-y-1">
        {seriesKeys.map((key, i) => (
          <span
            key={key}
            className="inline-flex items-center gap-[5px] text-[10.5px] text-muted-foreground"
          >
            <span
              className="h-[3px] w-[9px] rounded-[2px]"
              style={{ background: seriesColor(i) }}
            />
            {key}
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1">{chart}</div>
    </div>
  );
}
