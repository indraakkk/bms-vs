import type { CardType } from "@bms/contract";

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  kpi: "KPI",
  bar: "Bar Chart",
  line: "Line Chart",
  gauge: "Gauge",
};

export const CARD_DEFAULT_SIZE: Record<CardType, { w: number; h: number }> = {
  kpi: { w: 3, h: 3 },
  bar: { w: 6, h: 5 },
  line: { w: 6, h: 5 },
  gauge: { w: 3, h: 4 },
};

export function defaultCardTitle(cardType: CardType): string {
  return `New ${CARD_TYPE_LABEL[cardType]}`;
}
