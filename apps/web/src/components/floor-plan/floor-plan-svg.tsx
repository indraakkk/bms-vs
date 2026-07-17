"use client";

import type { ZoneOccupancy } from "@bms/contract";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { occupancyFill, occupancyInk } from "./occupancy-color";
import {
  FLOOR_LAYOUTS,
  FLOOR_PLAN_OUTLINE,
  FLOOR_PLAN_VIEWBOX,
} from "./zone-shapes";
import { ZoneTooltipBody } from "./zone-tooltip-body";

const MONO = "var(--font-plex-mono), ui-monospace, monospace";

export function FloorPlanSvg({
  buildingId,
  floor,
  zones,
}: {
  buildingId: string;
  floor: number;
  zones: ReadonlyArray<ZoneOccupancy>;
}) {
  const layout = FLOOR_LAYOUTS[`${buildingId}:${floor}`];
  if (!layout) return null;
  const zonesByName = new Map(zones.map((z) => [z.zone, z]));
  const outline = FLOOR_PLAN_OUTLINE;

  return (
    <svg
      viewBox={`0 0 ${FLOOR_PLAN_VIEWBOX.width} ${FLOOR_PLAN_VIEWBOX.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-auto max-h-[60vh] w-full"
      role="img"
      aria-label={`Floor plan for ${buildingId} floor ${floor}`}
    >
      <rect
        x={outline.x}
        y={outline.y}
        width={outline.w}
        height={outline.h}
        rx={16}
        fill="var(--secondary)"
        stroke="var(--border-strong)"
        strokeWidth={2}
      />

      {layout.rooms.map((room) => (
        <g key={room.label + room.x}>
          <rect
            x={room.x}
            y={room.y}
            width={room.w}
            height={room.h}
            rx={8}
            fill="var(--surface-3)"
            stroke="var(--border)"
            strokeWidth={1.5}
            strokeDasharray="4 5"
          />
          <text
            x={room.x + room.w / 2}
            y={room.y + room.h / 2 + 5}
            textAnchor="middle"
            style={{
              fontSize: 15,
              fill: "var(--fg-subtle)",
              letterSpacing: "1.5px",
              fontFamily: MONO,
            }}
          >
            {room.label}
          </text>
        </g>
      ))}

      {Object.entries(layout.zones).map(([zoneName, rect]) => {
        const zone = zonesByName.get(zoneName);
        const stale = zone?.isStale ?? true;
        const fill = zone ? occupancyFill(zone.occupancyRatePercent, zone.isStale) : "var(--occ-stale)";
        const ink = zone ? occupancyInk(zone.occupancyRatePercent, zone.isStale) : "var(--occ-stale-ink)";
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;

        return (
          <Tooltip key={zoneName}>
            <TooltipTrigger asChild>
              <g className="cursor-pointer outline-none">
                <rect
                  x={rect.x}
                  y={rect.y}
                  width={rect.w}
                  height={rect.h}
                  rx={12}
                  fill={fill}
                  stroke={fill}
                  strokeWidth={2}
                  opacity={stale ? 0.45 : 0.92}
                  style={{ transition: "opacity .3s, fill .3s, stroke .3s" }}
                />
                <rect
                  x={rect.x}
                  y={rect.y}
                  width={rect.w}
                  height={rect.h}
                  rx={12}
                  fill="none"
                  stroke="rgba(255,255,255,.14)"
                  strokeWidth={1}
                />
                <text
                  x={rect.x + 18}
                  y={rect.y + 31}
                  style={{ fontSize: 17, fontWeight: 700, fill: ink }}
                >
                  {zoneName}
                </text>
                {!zone ? (
                  <text
                    x={cx}
                    y={cy + 6}
                    textAnchor="middle"
                    style={{ fontSize: 17, fill: ink, opacity: 0.92 }}
                  >
                    No data
                  </text>
                ) : (
                  <g>
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      style={{
                        fontSize: 42,
                        fontWeight: 700,
                        fill: ink,
                        fontFamily: MONO,
                      }}
                    >
                      {zone.isStale ? "—" : String(zone.personCount)}
                    </text>
                    <text x={cx} y={cy + 24} textAnchor="middle" style={{ fontSize: 14, fill: ink }}>
                      {zone.isStale
                        ? "stale >1h"
                        : `of ${zone.zoneCapacity} · ${zone.occupancyRatePercent.toFixed(1)}%`}
                    </text>
                  </g>
                )}
                {stale && (
                  <text
                    x={rect.x + rect.w - 16}
                    y={rect.y + 27}
                    textAnchor="end"
                    style={{ fontSize: 15, fill: ink, opacity: 0.85 }}
                  >
                    ⚠
                  </text>
                )}
              </g>
            </TooltipTrigger>
            <TooltipContent
              showArrow={false}
              className="rounded-xl border border-border-strong bg-popover px-3.5 py-3 text-popover-foreground shadow-[0_16px_40px_-12px_rgba(0,0,0,.6)]"
            >
              {zone ? (
                <ZoneTooltipBody zone={zone} />
              ) : (
                <p className="text-[12px] text-muted-foreground">No data for this zone</p>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </svg>
  );
}
