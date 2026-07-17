import type { ZoneOccupancy } from "@bms/contract";
import { occupancyFill } from "./occupancy-color";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "22:00 · Jun 1" — UTC, matching the seed data's own labeling. */
function formatReading(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} · ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** The 6 required tooltip fields: zone+floor, occupancy %, person/capacity, CO2, AQI, timestamp. */
export function ZoneTooltipBody({ zone }: { zone: ZoneOccupancy }) {
  return (
    <div className="min-w-[188px]">
      <div className="mb-[9px] flex items-center gap-2">
        <span
          className="size-2.5 rounded-[3px] ring-1 ring-black/15 ring-inset dark:ring-white/15"
          style={{ background: occupancyFill(zone.occupancyRatePercent, zone.isStale) }}
        />
        <span className="font-extrabold text-[13.5px]">
          {zone.zone} · Floor {zone.floor}
        </span>
      </div>
      {zone.isStale && (
        <div className="mb-1.5 text-[12px] text-muted-foreground">
          No recent reading · stale &gt; 1h
        </div>
      )}
      <div className="grid grid-cols-[auto_auto] gap-x-[18px] gap-y-[5px] text-[12px]">
        <TipRow label="Occupancy" value={`${zone.occupancyRatePercent.toFixed(1)}%`} />
        <TipRow label="People" value={`${zone.personCount} / ${zone.zoneCapacity}`} />
        <TipRow label="CO₂" value={`${zone.co2Ppm} ppm`} />
        <TipRow label="Air quality" value={`AQI ${zone.airQualityIndex}`} />
        <TipRow label="Reading" value={formatReading(zone.timestamp)} />
      </div>
    </div>
  );
}

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-fg-subtle">{label}</span>
      <span className="text-right font-mono font-semibold">{value}</span>
    </>
  );
}
