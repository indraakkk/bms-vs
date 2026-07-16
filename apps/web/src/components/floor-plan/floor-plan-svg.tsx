"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOccupancyLatest } from "@/hooks/use-occupancy-latest";
import { occupancyFill } from "./occupancy-color";
import { FLOOR_PLAN_VIEWBOX, ZONE_SHAPES } from "./zone-shapes";
import { ZoneTooltipBody } from "./zone-tooltip-body";

export function FloorPlanSvg({ buildingId, floor }: { buildingId: string; floor: number }) {
  const { data, isPending, isError } = useOccupancyLatest(buildingId, floor);
  const shapes = ZONE_SHAPES[`${buildingId}:${floor}`] ?? {};
  const zonesByName = new Map((data?.zones ?? []).map((z) => [z.zone, z]));

  if (isPending) {
    return <Skeleton className="aspect-[7/5] w-full max-w-2xl" />;
  }
  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Failed to load occupancy data for {buildingId} floor {floor}.
      </p>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${FLOOR_PLAN_VIEWBOX.width} ${FLOOR_PLAN_VIEWBOX.height}`}
      className="w-full max-w-2xl rounded-lg border bg-card"
      role="img"
      aria-label={`Floor plan for ${buildingId} floor ${floor}`}
    >
      <rect
        x={20}
        y={10}
        width={380}
        height={30}
        rx={4}
        className="fill-muted stroke-border"
        strokeWidth={1}
      />
      <text
        x={210}
        y={29}
        textAnchor="middle"
        className="fill-muted-foreground text-[10px] uppercase"
        style={{ letterSpacing: "0.08em" }}
      >
        Reception
      </text>

      {Object.entries(shapes).map(([zoneName, rect]) => {
        const zone = zonesByName.get(zoneName);
        const fill = zone ? occupancyFill(zone.occupancyRatePercent, zone.isStale) : "#e5e5e5";
        const textStyle = { paintOrder: "stroke" as const, stroke: "rgba(0,0,0,0.35)", strokeWidth: 3 };

        return (
          <Tooltip key={zoneName}>
            <TooltipTrigger asChild>
              <g className="cursor-pointer outline-none">
                <rect
                  x={rect.x}
                  y={rect.y}
                  width={rect.w}
                  height={rect.h}
                  rx={6}
                  fill={fill}
                  className="stroke-border transition-opacity hover:opacity-85"
                  strokeWidth={1.5}
                />
                <text
                  x={rect.x + rect.w / 2}
                  y={rect.y + 16}
                  textAnchor="middle"
                  className="fill-white text-[9px] uppercase"
                  style={textStyle}
                >
                  {rect.roomLabel}
                </text>
                <text
                  x={rect.x + rect.w / 2}
                  y={rect.y + rect.h / 2}
                  textAnchor="middle"
                  className="fill-white font-semibold text-sm"
                  style={textStyle}
                >
                  {zoneName}
                </text>
                <text
                  x={rect.x + rect.w / 2}
                  y={rect.y + rect.h / 2 + 18}
                  textAnchor="middle"
                  className="fill-white text-[11px]"
                  style={textStyle}
                >
                  {zone && !zone.isStale ? `${zone.personCount} people` : "No data"}
                </text>
              </g>
            </TooltipTrigger>
            <TooltipContent>{zone ? <ZoneTooltipBody zone={zone} /> : <p>No data</p>}</TooltipContent>
          </Tooltip>
        );
      })}
    </svg>
  );
}
