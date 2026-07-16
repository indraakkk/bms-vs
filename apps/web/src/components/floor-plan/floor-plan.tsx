"use client";

import type { ZoneOccupancy } from "@bms/contract";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useOccupancyLatest } from "@/hooks/use-occupancy-latest";
import { cn } from "@/lib/utils";
import { FloorPlanSvg } from "./floor-plan-svg";
import { occupancyFill } from "./occupancy-color";
import { BUILDING_FLOOR_TABS, FLOOR_LAYOUTS } from "./zone-shapes";

function tabKey(buildingId: string, floor: number) {
  return `${buildingId}:${floor}`;
}

const LEGEND = [
  { token: "var(--occ-low)", label: "Low <40%" },
  { token: "var(--occ-mid)", label: "Medium" },
  { token: "var(--occ-high)", label: "High >70%" },
  { token: "var(--occ-stale)", label: "No data" },
];

export function FloorPlan() {
  const [active, setActive] = useState(
    tabKey(BUILDING_FLOOR_TABS[0].buildingId, BUILDING_FLOOR_TABS[0].floor),
  );
  const [activeBuilding, activeFloor] = active.split(":");
  // Shares the active tab's TanStack cache entry — no extra fetch, just
  // the freshest dataUpdatedAt for the header chip.
  const activeQuery = useOccupancyLatest(activeBuilding, Number(activeFloor));

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <header className="flex items-center gap-3.5 border-b bg-card px-[22px] pt-[15px] pb-[13px]">
          <div>
            <h1 className="font-extrabold text-[18px] tracking-[-0.3px]">Floor Plan</h1>
            <div className="mt-px text-[12px] text-fg-subtle">
              Live zone occupancy &amp; air quality overlay
            </div>
          </div>
          <div className="flex-1" />
          <UpdatedChip updatedAt={activeQuery.dataUpdatedAt} />
        </header>

        <Tabs
          value={active}
          onValueChange={setActive}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <TabsList className="h-auto w-auto justify-start gap-0.5 self-start rounded-none border-0 bg-transparent px-[22px] pt-3 pb-0">
            {BUILDING_FLOOR_TABS.map((t) => (
              <TabsTrigger
                key={tabKey(t.buildingId, t.floor)}
                value={tabKey(t.buildingId, t.floor)}
                className={cn(
                  "h-auto flex-none rounded-t-[9px] rounded-b-none border border-transparent border-b-0 px-[15px] py-[9px] font-semibold text-[13px] text-muted-foreground shadow-none",
                  "data-[state=active]:-mb-px data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-none",
                  "dark:data-[state=active]:border-border dark:data-[state=active]:bg-card",
                )}
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {BUILDING_FLOOR_TABS.map((t) => (
            <TabsContent
              key={tabKey(t.buildingId, t.floor)}
              value={tabKey(t.buildingId, t.floor)}
              className="min-h-0 flex-1 overflow-auto"
            >
              <FloorPlanView buildingId={t.buildingId} floor={t.floor} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

/** "Updated Ns ago", ticking every second against the query's own clock.
 *  Recomputed only inside timer callbacks — Date.now() is impure during
 *  render, and setState must not run synchronously in the effect body. */
function UpdatedChip({ updatedAt }: { updatedAt: number }) {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    const update = () =>
      setSeconds(updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt) / 1000)) : null);
    const first = setTimeout(update, 0);
    const t = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [updatedAt]);

  return (
    <div className="flex items-center gap-[7px] font-mono text-[11.5px] text-muted-foreground">
      <span className="size-[7px] animate-[livedot_1.6s_ease-in-out_infinite] rounded-full bg-ok" />
      {seconds === null ? "Loading…" : `Updated ${seconds}s ago`}
    </div>
  );
}

function FloorPlanView({ buildingId, floor }: { buildingId: string; floor: number }) {
  const { data, isPending, isError } = useOccupancyLatest(buildingId, floor);
  const zones = data?.zones ?? [];

  return (
    <div className="flex min-h-0 gap-[18px] px-[22px] pt-4 pb-[22px]">
      <div className="flex min-w-0 flex-1 flex-col rounded-2xl border bg-card p-[18px]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold text-[14px]">
            {buildingId} · Floor {floor}
          </div>
          <div className="flex gap-3.5 text-[11px] text-muted-foreground">
            {LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className="size-[11px] rounded-[3px]" style={{ background: item.token }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {isPending ? (
            <Skeleton className="aspect-[1000/560] w-full rounded-xl" />
          ) : isError ? (
            <p className="text-[13px] text-crit">
              Failed to load occupancy data for {buildingId} floor {floor}.
            </p>
          ) : (
            <FloorPlanSvg buildingId={buildingId} floor={floor} zones={zones} />
          )}
        </div>
      </div>

      <div className="flex w-[280px] shrink-0 flex-col gap-3">
        <ZoneSummaryCard buildingId={buildingId} floor={floor} zones={zones} />
        <div className="rounded-[14px] border bg-card p-[15px]">
          <div className="mb-2.5 font-bold text-[11px] text-fg-subtle tracking-[0.6px]">
            ENDPOINT
          </div>
          <div className="break-all rounded-[9px] bg-surface-3 px-[11px] py-[9px] font-mono text-[11px] text-muted-foreground leading-relaxed">
            GET /api/occupancy/latest
            <br />
            ?building_id={buildingId}
            <br />
            &amp;floor={floor}
          </div>
          <div className="mt-[9px] text-[11px] text-fg-subtle leading-normal">
            Auto-refresh every 30s · zones stale &gt;1h render gray.
          </div>
        </div>
      </div>
    </div>
  );
}

function ZoneSummaryCard({
  buildingId,
  floor,
  zones,
}: {
  buildingId: string;
  floor: number;
  zones: ReadonlyArray<ZoneOccupancy>;
}) {
  const layout = FLOOR_LAYOUTS[`${buildingId}:${floor}`];
  const zonesByName = new Map(zones.map((z) => [z.zone, z]));
  const names = Object.keys(layout?.zones ?? {});

  return (
    <div className="rounded-[14px] border bg-card p-[15px]">
      <div className="mb-[11px] font-bold text-[11px] text-fg-subtle tracking-[0.6px]">
        ZONE SUMMARY
      </div>
      {names.map((name) => {
        const zone = zonesByName.get(name);
        const color = zone
          ? occupancyFill(zone.occupancyRatePercent, zone.isStale)
          : "var(--occ-stale)";
        const detail = !zone
          ? "no reading"
          : zone.isStale
            ? "stale >1h"
            : `${zone.personCount} / ${zone.zoneCapacity} people`;
        const rate = !zone || zone.isStale ? "—" : `${zone.occupancyRatePercent.toFixed(1)}%`;
        return (
          <div key={name} className="flex items-center gap-[11px] border-b py-[9px] last:border-b-0">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[13px]">{name}</div>
              <div className="text-[11px] text-fg-subtle">{detail}</div>
            </div>
            <div className="font-mono font-semibold text-[15px]" style={{ color }}>
              {rate}
            </div>
          </div>
        );
      })}
    </div>
  );
}
