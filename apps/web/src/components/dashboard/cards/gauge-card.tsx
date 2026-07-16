import { type CardConfig, findColumn, type QueryResponse } from "@bms/contract";
import { CHART_GRIDLINE, STATUS } from "@/components/dashboard/cards/chart-colors";
import { formatNumber } from "@/components/dashboard/cards/chart-utils";

const CX = 100;
const CY = 100;
const R = 80;
const STROKE = 14;

function polarToCartesian(angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: CX + R * Math.cos(angleRad), y: CY - R * Math.sin(angleRad) };
}

function arcPath(startAngle: number, endAngle: number) {
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArcFlag = startAngle - endAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

/** min→max maps to 180°→0° (a left-to-right semicircle swept over the top). */
function angleFor(value: number, min: number, max: number) {
  const fraction = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return 180 - fraction * 180;
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
  const metricLabel = findColumn(config.source, config.metric)?.label ?? config.metric;

  const distanceFromTarget = Math.abs(value - target) / (max - min || 1);
  const valueColor =
    distanceFromTarget <= 0.1
      ? STATUS.good
      : distanceFromTarget <= 0.25
        ? STATUS.warning
        : STATUS.critical;

  const valueAngle = angleFor(value, min, max);
  const targetAngle = angleFor(target, min, max);
  const targetTick = {
    inner: polarToCartesian(targetAngle),
    outer: {
      x: CX + (R + STROKE / 2 + 6) * Math.cos((targetAngle * Math.PI) / 180),
      y: CY - (R + STROKE / 2 + 6) * Math.sin((targetAngle * Math.PI) / 180),
    },
  };

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <svg viewBox="0 0 200 115" className="w-full max-w-[220px]">
        <path
          d={arcPath(180, 0)}
          fill="none"
          stroke={CHART_GRIDLINE}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <path
          d={arcPath(180, valueAngle)}
          fill="none"
          stroke={valueColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <line
          x1={targetTick.inner.x}
          y1={targetTick.inner.y}
          x2={targetTick.outer.x}
          y2={targetTick.outer.y}
          stroke="currentColor"
          strokeWidth={2}
        />
        <text x={CX} y={CY - 4} textAnchor="middle" className="fill-foreground font-semibold text-2xl">
          {formatNumber(value)}
        </text>
        <text x={CX} y={CY + 16} textAnchor="middle" className="fill-muted-foreground text-[10px] uppercase">
          {config.aggregation} · {metricLabel}
        </text>
      </svg>
    </div>
  );
}
