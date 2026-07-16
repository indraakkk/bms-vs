import type { CardConfig, QueryResponse } from "@bms/contract";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORICAL, CHART_GRIDLINE, CHART_MUTED } from "@/components/dashboard/cards/chart-colors";
import { formatNumber } from "@/components/dashboard/cards/chart-utils";
import { severityColor } from "@/components/ui/severity-badge";

export function BarCard({
  config,
  data,
}: {
  config: Extract<CardConfig, { cardType: "bar" }>;
  data: QueryResponse;
}) {
  // Severity is a fixed-meaning status dimension (Critical/Warning/Info),
  // never a generic category — color it from the reserved status palette
  // instead of the rotating categorical one.
  const isSeverity = config.x === "severity";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={[...data.rows]} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART_GRIDLINE} />
        <XAxis
          dataKey="x"
          tick={{ fontSize: 11, fill: CHART_MUTED }}
          axisLine={{ stroke: CHART_GRIDLINE }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: CHART_MUTED }}
          axisLine={false}
          tickLine={false}
          width={40}
          tickFormatter={formatNumber}
        />
        <Tooltip
          formatter={(value: number) => formatNumber(value)}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Bar dataKey="y" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {isSeverity
            ? data.rows.map((row) => (
                <Cell key={String(row.x)} fill={severityColor(String(row.x))} />
              ))
            : data.rows.map((row) => <Cell key={String(row.x)} fill={CATEGORICAL[0]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
