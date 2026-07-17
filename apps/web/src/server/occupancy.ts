import type { DbError, OccupancyLatestResponse, ZoneOccupancy } from "@bms/contract";
import { Context, Effect, Layer } from "effect";
import { ClockService } from "./clock";
import { PrismaService, tryDb } from "./prisma";

const STALE_AFTER_MS = 60 * 60 * 1000;

export class OccupancyService extends Context.Service<
  OccupancyService,
  {
    readonly latest: (
      buildingId: string,
      floor: number,
    ) => Effect.Effect<OccupancyLatestResponse, DbError>;
  }
>()("OccupancyService") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const clock = yield* ClockService;

      const latest = Effect.fn("OccupancyService.latest")(function* (
        buildingId: string,
        floor: number,
      ) {
        // No DISTINCT ON / window-function support needed at this data
        // scale (a handful of rows per zone) — fetch newest-first and
        // keep the first row seen per zone in JS.
        const rows = yield* tryDb(() =>
          prisma.occupancy.findMany({
            where: { buildingId, floor },
            orderBy: { timestamp: "desc" },
          }),
        );

        const seenZones = new Set<string>();
        const now = clock.now();
        const zones: ZoneOccupancy[] = [];
        for (const row of rows) {
          if (seenZones.has(row.zone)) continue;
          seenZones.add(row.zone);
          zones.push({
            buildingId: row.buildingId,
            floor: row.floor,
            zone: row.zone,
            occupancyRatePercent: row.occupancyRatePercent,
            personCount: row.personCount,
            zoneCapacity: row.zoneCapacity,
            co2Ppm: row.co2Ppm,
            airQualityIndex: row.airQualityIndex,
            temperatureC: row.temperatureC,
            timestamp: row.timestamp.toISOString(),
            isStale: now.getTime() - row.timestamp.getTime() > STALE_AFTER_MS,
          });
        }
        return { zones };
      });

      return { latest };
    }),
  );
}
