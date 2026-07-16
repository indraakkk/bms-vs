import type { CardConfig, QueryResponse } from "@bms/contract";
import { CHART_MONO } from "@/components/dashboard/cards/chart-colors";
import { formatCompact } from "@/components/dashboard/cards/chart-utils";
import { unitFor } from "@/lib/card-defaults";

/** Geometry per the design mock: 230×150 semicircle, r=88, 14px stroke. */
const W = 230;
const H = 150;
const CX = W / 2;
const CY = H - 18;
const R = 88;
const STROKE = 14;

/** fraction 0..1 → point on the semicircle (0 = left end, 1 = right end). */
function pointAt(fraction: number, radius: number): [number, number] {
  const angle = Math.PI * (1 - fraction);
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
}

function arcPath(from: number, to: number, radius: number): string {
  const [x0, y0] = pointAt(from, radius);
  const [x1, y1] = pointAt(to, radius);
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${radius} ${radius} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

export function GaugeCard({
  config,
  data,
}: {
  config: Extract<CardConfig, { cardType: "gauge" }>;
  data: QueryResponse;
}) {
  const value = data.rows[0]?.y ?? 0;
  const { min, max, target } = config;
  const unit = config.aggregation === "count" ? "" : unitFor(config.source, config.metric);

  const fractionOf = (v: number) =>
    (Math.max(min, Math.min(max, v)) - min) / (max - min || 1);
  const valueFraction = fractionOf(value);
  const targetFraction = fractionOf(target);

  // Reached target → ok; within 70% of it → warn; otherwise neutral.
  const arcColor =
    valueFraction >= targetFraction
      ? "var(--ok)"
      : valueFraction >= targetFraction * 0.7
        ? "var(--warn)"
        : "var(--primary)";

  const tickOuter = pointAt(targetFraction, R);
  const tickInner = pointAt(targetFraction, R - 14);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full"
      role="img"
      aria-label={`Gauge: ${formatCompact(value)} of target ${formatCompact(target)}`}
    >
      <path
        d={arcPath(0, 1, R)}
        fill="none"
        stroke="var(--surface-3)"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d={arcPath(0, Math.max(0.001, valueFraction), R)}
        fill="none"
        stroke={arcColor}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <line
        x1={tickInner[0]}
        y1={tickInner[1]}
        x2={tickOuter[0]}
        y2={tickOuter[1]}
        stroke="var(--foreground)"
        strokeWidth={2}
      />
      <text
        x={CX}
        y={CY - 24}
        textAnchor="middle"
        style={{
          fontSize: 30,
          fontWeight: 600,
          fill: "var(--foreground)",
          fontFamily: CHART_MONO,
        }}
      >
        {formatCompact(value)}
      </text>
      <text x={CX} y={CY - 8} textAnchor="middle" style={{ fontSize: 10, fill: "var(--fg-subtle)" }}>
        {unit ? `${unit} · ` : ""}target {formatCompact(target)}
      </text>
      <text
        x={pointAt(0, R)[0]}
        y={CY + 14}
        textAnchor="middle"
        style={{ fontSize: 9, fill: "var(--fg-subtle)", fontFamily: CHART_MONO }}
      >
        {formatCompact(min)}
      </text>
      <text
        x={pointAt(1, R)[0]}
        y={CY + 14}
        textAnchor="middle"
        style={{ fontSize: 9, fill: "var(--fg-subtle)", fontFamily: CHART_MONO }}
      >
        {formatCompact(max)}
      </text>
    </svg>
  );
}
