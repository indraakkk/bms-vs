import type { QueryRow } from "@bms/contract";

/**
 * Reshapes long-format rows ({x, y, series?}) into one row per x with a
 * numeric column per series, the shape Recharts' multi-line rendering
 * expects. Series names are sorted for a stable, deterministic color
 * assignment across refetches (not insertion order, which raw SQL GROUP
 * BY doesn't guarantee).
 */
export function pivotSeries(rows: ReadonlyArray<QueryRow>): {
  data: Array<Record<string, string | number>>;
  seriesKeys: string[];
} {
  const seriesKeys = [...new Set(rows.map((r) => r.series ?? "value"))].sort();
  const byX = new Map<string | number, Record<string, string | number>>();
  for (const row of rows) {
    const key = row.series ?? "value";
    const existing = byX.get(row.x) ?? { x: row.x };
    existing[key] = row.y;
    byX.set(row.x, existing);
  }
  return { data: [...byX.values()], seriesKeys };
}

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function formatTimestamp(x: string | number): string {
  const date = new Date(x);
  if (Number.isNaN(date.getTime())) return String(x);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
