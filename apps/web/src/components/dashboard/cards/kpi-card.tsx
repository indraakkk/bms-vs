// biome-ignore-all lint/a11y/noSvgWithoutTitle: decorative sparkline behind the KPI number, already aria-hidden — the value/unit text carries the meaning.
"use client";

import type { CardConfig, QueryResponse } from "@bms/contract";
import { formatCompact } from "@/components/dashboard/cards/chart-utils";
import { useKpiSpark } from "@/hooks/use-kpi-spark";
import { unitFor } from "@/lib/card-defaults";

/**
 * Trend delta per the design mock: average of the last third of hourly
 * buckets vs the first third. Needs ≥3 buckets to mean anything.
 */
function computeDelta(spark: number[]): number | null {
  if (spark.length < 3) return null;
  const third = Math.floor(spark.length / 3);
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
  const early = avg(spark.slice(0, third));
  if (!early) return null;
  return ((avg(spark.slice(-third)) - early) / Math.abs(early)) * 100;
}

export function KpiCard({
  cardId,
  config,
  data,
}: {
  cardId: string;
  config: Extract<CardConfig, { cardType: "kpi" }>;
  data: QueryResponse;
}) {
  const value = data.rows[0]?.y ?? 0;
  const unit = config.aggregation === "count" ? "" : unitFor(config.source, config.metric);
  const sparkQuery = useKpiSpark(cardId, config);
  const spark = (sparkQuery.data?.rows ?? []).map((r) => r.y);
  const delta = computeDelta(spark);
  const up = delta !== null && delta >= 0;

  return (
    <div className="flex h-full flex-col justify-between gap-1.5">
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span className="font-medium font-mono text-[clamp(26px,7vw,42px)] leading-none tracking-[-0.5px]">
          {formatCompact(value)}
        </span>
        {unit && <span className="font-semibold text-[13px] text-muted-foreground">{unit}</span>}
      </div>

      {delta !== null ? (
        <div
          className="inline-flex items-center gap-1 self-start rounded-full px-2 py-[3px] font-bold font-mono text-[11.5px]"
          style={{
            background: up ? "var(--ok-soft)" : "var(--crit-soft)",
            color: up ? "var(--ok)" : "var(--crit)",
          }}
        >
          {`${up ? "▲" : "▼"}${Math.abs(delta).toFixed(1)}%`}
          <span className="font-medium text-fg-subtle">vs early</span>
        </div>
      ) : (
        <div className="text-[11.5px] text-fg-subtle">across the period</div>
      )}

      {spark.length > 1 ? <Sparkline values={spark} /> : <div />}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const W = 200;
  const H = 40;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - ((v - min) / range) * (H - 6) - 3,
  ]);
  const path = `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block h-[38px] w-full"
      aria-hidden
    >
      <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill="var(--primary)" opacity={0.1} />
      <path
        d={path}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
