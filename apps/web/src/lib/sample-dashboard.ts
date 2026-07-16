import type { DashboardCard, GridLayoutItem } from "@bms/contract";

/**
 * The design mock's "Load sample dashboard" preset, rebuilt against the
 * real contract: every config below round-trips through /api/query
 * (column names come from TABLE_META, not invented).
 */
export function buildSampleDashboard(): {
  cards: DashboardCard[];
  layout: GridLayoutItem[];
} {
  const ids = Array.from({ length: 7 }, () => crypto.randomUUID());

  const cards: DashboardCard[] = [
    {
      id: ids[0],
      cardType: "kpi",
      title: "Avg Occupancy Rate (%)",
      config: {
        cardType: "kpi",
        source: "occupancy",
        metric: "occupancyRatePercent",
        aggregation: "avg",
      },
    },
    {
      id: ids[1],
      cardType: "kpi",
      title: "Sum Energy (kWh)",
      config: {
        cardType: "kpi",
        source: "energyConsumption",
        metric: "energyKwh",
        aggregation: "sum",
      },
    },
    {
      id: ids[2],
      cardType: "kpi",
      title: "Total Alerts",
      config: { cardType: "kpi", source: "alertsEvents", metric: "value", aggregation: "count" },
    },
    {
      id: ids[3],
      cardType: "gauge",
      title: "Energy Efficiency Ratio",
      config: {
        cardType: "gauge",
        source: "hvacPerformance",
        metric: "energyEfficiencyRatio",
        aggregation: "avg",
        min: 0,
        max: 5,
        target: 3.5,
      },
    },
    {
      id: ids[4],
      cardType: "line",
      title: "Person Count trend",
      config: {
        cardType: "line",
        source: "occupancy",
        x: "timestamp",
        y: "personCount",
        aggregation: "sum",
        groupBy: "buildingId",
      },
    },
    {
      id: ids[5],
      cardType: "bar",
      title: "Energy (kWh) by Device Type",
      config: {
        cardType: "bar",
        source: "energyConsumption",
        x: "deviceType",
        y: "energyKwh",
        aggregation: "sum",
      },
    },
    {
      id: ids[6],
      cardType: "bar",
      title: "Alerts by Severity",
      config: {
        cardType: "bar",
        source: "alertsEvents",
        x: "severity",
        y: "value",
        aggregation: "count",
      },
    },
  ];

  const layout: GridLayoutItem[] = [
    { i: ids[0], x: 0, y: 0, w: 3, h: 1 },
    { i: ids[1], x: 3, y: 0, w: 3, h: 1 },
    { i: ids[2], x: 6, y: 0, w: 3, h: 1 },
    { i: ids[3], x: 9, y: 0, w: 3, h: 1 },
    { i: ids[4], x: 0, y: 1, w: 6, h: 2 },
    { i: ids[5], x: 6, y: 1, w: 6, h: 1 },
    { i: ids[6], x: 6, y: 2, w: 6, h: 1 },
  ];

  return { cards, layout };
}
