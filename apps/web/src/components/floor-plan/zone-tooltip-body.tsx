import type { ZoneOccupancy } from "@bms/contract";

/** The 6 required tooltip fields: zone+floor, occupancy %, person/capacity, CO2, AQI, timestamp. */
export function ZoneTooltipBody({ zone }: { zone: ZoneOccupancy }) {
  return (
    <div className="space-y-0.5 text-xs">
      <p className="font-semibold">
        {zone.zone} · Floor {zone.floor}
      </p>
      <p>Occupancy: {zone.occupancyRatePercent.toFixed(1)}%</p>
      <p>
        {zone.personCount} / {zone.zoneCapacity} people
      </p>
      <p>CO2: {zone.co2Ppm} ppm</p>
      <p>AQI: {zone.airQualityIndex}</p>
      <p>Updated: {new Date(zone.timestamp).toLocaleString()}</p>
      {zone.isStale && <p className="font-medium text-destructive">Stale (&gt;1h old)</p>}
    </div>
  );
}
