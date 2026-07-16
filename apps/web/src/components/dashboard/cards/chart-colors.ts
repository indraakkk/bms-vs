/** Validated categorical palette (fixed order — never reassigned per render). */
export const CATEGORICAL = [
  "#2a78d6", // blue
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
  "#e87ba4", // magenta
  "#eb6834", // orange
];

export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

export const CHART_MUTED = "#898781";
export const CHART_GRIDLINE = "#e1e0d9";

export function categoricalColor(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length];
}
