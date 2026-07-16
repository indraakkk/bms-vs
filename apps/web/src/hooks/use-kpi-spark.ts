import type { CardConfig } from "@bms/contract";
import { useQuery } from "@tanstack/react-query";
import { postQuery } from "@/lib/api";
import { useFilterStore } from "@/stores/filter-store";

/**
 * The design's KPI card carries an hourly sparkline + trend delta. The
 * real equivalent of the mock's client-side groupHours() is a second,
 * line-shaped query over the same metric/aggregation — same validation
 * path, same global-filter key semantics as the main card query.
 */
export function useKpiSpark(cardId: string, config: Extract<CardConfig, { cardType: "kpi" }>) {
  const filters = useFilterStore((s) => s.filters);

  const sparkConfig: CardConfig = {
    cardType: "line",
    source: config.source,
    x: "timestamp",
    y: config.metric,
    aggregation: config.aggregation,
    filter: config.filter,
  };

  return useQuery({
    queryKey: ["card-spark", cardId, sparkConfig, filters],
    queryFn: () => postQuery(sparkConfig, filters),
  });
}
