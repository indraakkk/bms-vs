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

/** The design mock's fmt(): 2.4M / 12.5k / 1,745 / 46.7 / 0.92. */
export function formatCompact(value: number): string {
  if (value == null || Number.isNaN(value)) return "–";
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(1)}k`;
  if (abs >= 1e3) return Math.round(value).toLocaleString("en-US");
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(abs < 10 ? 2 : 1);
}

/**
 * Axis/tooltip time formatting is UTC on purpose: the seed data is
 * UTC-labeled calendar timestamps (see server/clock.ts), and the mock
 * labels the hourly buckets 00–22 accordingly. Local-time display would
 * shift a UTC+7 viewer's "14:00" bucket to "21:00".
 */
export function formatHourUtc(x: string | number): string {
  const date = new Date(x);
  if (Number.isNaN(date.getTime())) return String(x);
  return String(date.getUTCHours()).padStart(2, "0");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatTimestampUtc(x: string | number): string {
  const date = new Date(x);
  if (Number.isNaN(date.getTime())) return String(x);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()} · ${hh}:${mm} UTC`;
}

export function truncateLabel(value: string | number, max = 9): string {
  const s = String(value);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
