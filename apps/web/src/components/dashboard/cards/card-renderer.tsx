import type { CardConfig, QueryResponse } from "@bms/contract";
import { BarCard } from "@/components/dashboard/cards/bar-card";
import { GaugeCard } from "@/components/dashboard/cards/gauge-card";
import { KpiCard } from "@/components/dashboard/cards/kpi-card";
import { LineCard } from "@/components/dashboard/cards/line-card";

export function CardRenderer({
  config,
  data,
}: {
  config: CardConfig;
  data: QueryResponse;
}) {
  switch (config.cardType) {
    case "kpi":
      return <KpiCard config={config} data={data} />;
    case "bar":
      return <BarCard config={config} data={data} />;
    case "line":
      return <LineCard config={config} data={data} />;
    case "gauge":
      return <GaugeCard config={config} data={data} />;
  }
}
