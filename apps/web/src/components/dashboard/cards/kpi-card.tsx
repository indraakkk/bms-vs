import { type CardConfig, findColumn, type QueryResponse } from "@bms/contract";
import { formatNumber } from "@/components/dashboard/cards/chart-utils";

export function KpiCard({
  config,
  data,
}: {
  config: Extract<CardConfig, { cardType: "kpi" }>;
  data: QueryResponse;
}) {
  const value = data.rows[0]?.y ?? 0;
  const metricLabel = findColumn(config.source, config.metric)?.label ?? config.metric;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      <span className="font-semibold text-3xl tabular-nums">{formatNumber(value)}</span>
      <span className="text-muted-foreground text-xs capitalize">
        {config.aggregation} · {metricLabel}
      </span>
    </div>
  );
}
