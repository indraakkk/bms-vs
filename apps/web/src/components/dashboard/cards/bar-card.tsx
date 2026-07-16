import type { CardConfig, QueryResponse } from "@bms/contract";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_GRID,
  CHART_MONO,
  CHART_TICK,
  SERIES_COLORS,
} from "@/components/dashboard/cards/chart-colors";
import {
  formatCompact,
  formatNumber,
  truncateLabel,
} from "@/components/dashboard/cards/chart-utils";
import { severityColor } from "@/components/ui/severity-badge";

const TOOLTIP_STYLE: React.CSSProperties = {
  fontSize: 12,
  borderRadius: 10,
  background: "var(--popover)",
  border: "1px solid var(--border-strong)",
  color: "var(--popover-foreground)",
  boxShadow: "0 16px 40px -12px rgba(0,0,0,.4)",
};

export function BarCard({
  config,
  data,
}: {
  config: Extract<CardConfig, { cardType: "bar" }>;
  data: QueryResponse;
}) {
  // Severity is a fixed-meaning status dimension (Critical/Warning/Info),
  // never a generic category — color it from the reserved status tokens
  // instead of the mock's monochrome series ramp.
  const isSeverity = config.x === "severity";

  // The mock ranks bars by value and shows at most 12 — the card footer's
  // row count still reports the full result, so the cut is discoverable.
  const rows = [...data.rows].sort((a, b) => b.y - a.y).slice(0, 12);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 14, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART_GRID} />
        <XAxis
          dataKey="x"
          tickFormatter={(v) => truncateLabel(v)}
          tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          interval={0}
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
          formatter={(value: number) => formatNumber(value)}
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "var(--accent)", opacity: 0.5 }}
        />
        <Bar dataKey="y" radius={[4, 4, 0, 0]} maxBarSize={48}>
          <LabelList
            dataKey="y"
            position="top"
            formatter={(value: number) => formatCompact(value)}
            style={{ fontSize: 8.5, fill: CHART_TICK, fontFamily: CHART_MONO }}
          />
          {rows.map((row) => (
            <Cell
              key={String(row.x)}
              fill={isSeverity ? severityColor(String(row.x)) : SERIES_COLORS[0]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
