import { type CardConfig, type CardType, type DataSource, findColumn } from "@bms/contract";

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  kpi: "KPI Card",
  bar: "Bar Chart",
  line: "Line Chart",
  gauge: "Gauge",
};

/** Palette blurbs, verbatim from the design mock. */
export const CARD_TYPE_DESC: Record<CardType, string> = {
  kpi: "Single aggregated metric",
  bar: "Compare categories",
  line: "Trends over time",
  gauge: "Value in a min–max range",
};

export const SOURCE_LABEL: Record<DataSource, string> = {
  energyConsumption: "Energy Consumption",
  hvacPerformance: "HVAC Performance",
  occupancy: "Occupancy",
  alertsEvents: "Alerts & Events",
};

/**
 * 12-column grid with 198px rows — the design's 4-column × 198px card
 * grid expressed in RGL units (1 design column = 3 RGL columns), so
 * KPI/gauge are quarter-width and bar/line half-width singles.
 */
export const CARD_DEFAULT_SIZE: Record<CardType, { w: number; h: number }> = {
  kpi: { w: 3, h: 1 },
  bar: { w: 6, h: 1 },
  line: { w: 6, h: 1 },
  gauge: { w: 3, h: 1 },
};

export function defaultCardTitle(cardType: CardType): string {
  return `New ${CARD_TYPE_LABEL[cardType]}`;
}

export function columnLabel(source: DataSource, column: string): string {
  return findColumn(source, column)?.label ?? column;
}

/** "kWh" out of "Energy (kWh)" — the unit chip beside KPI/gauge values. */
export function unitFor(source: DataSource, column: string): string {
  const match = columnLabel(source, column).match(/\(([^)]+)\)/);
  return match ? match[1] : "";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** One-line config summary under the card title, per the design mock. */
export function summarizeConfig(config: CardConfig): string {
  const agg = capitalize(config.aggregation);
  const isCount = config.aggregation === "count";
  switch (config.cardType) {
    case "kpi":
      return isCount ? "Count of records" : `${agg} of ${columnLabel(config.source, config.metric)}`;
    case "gauge":
      return isCount ? "Count" : `${agg} ${columnLabel(config.source, config.metric)}`;
    case "bar":
      return `${
        isCount ? "Count" : `${agg} ${columnLabel(config.source, config.y)}`
      } by ${columnLabel(config.source, config.x)}`;
    case "line":
      return `${isCount ? "Count" : `${agg} ${columnLabel(config.source, config.y)}`} over time${
        config.groupBy ? ` · by ${columnLabel(config.source, config.groupBy)}` : ""
      }`;
  }
}
