import type { CardConfig, QueryResponse } from "@bms/contract";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { categoricalColor, CHART_GRIDLINE, CHART_MUTED } from "@/components/dashboard/cards/chart-colors";
import { formatNumber, formatTimestamp, pivotSeries } from "@/components/dashboard/cards/chart-utils";

export function LineCard({
  data,
}: {
  config: Extract<CardConfig, { cardType: "line" }>;
  data: QueryResponse;
}) {
  const { data: pivoted, seriesKeys } = pivotSeries(data.rows);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={pivoted} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART_GRIDLINE} />
        <XAxis
          dataKey="x"
          tickFormatter={formatTimestamp}
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
          labelFormatter={formatTimestamp}
          formatter={(value: number) => formatNumber(value)}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {seriesKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={key}
            stroke={categoricalColor(i)}
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
