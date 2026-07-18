import { ValidationError } from "@bms/contract";
import { Effect } from "effect";
import { handleEffect } from "@/server/http";
import { OccupancyService } from "@/server/occupancy";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const buildingId = searchParams.get("building_id");
  const floorParam = searchParams.get("floor");

  return handleEffect(() =>
    Effect.gen(function* () {
      if (!buildingId || !floorParam) {
        return yield* new ValidationError({
          message: "Query params 'building_id' and 'floor' are required",
        });
      }
      const floor = Number(floorParam);
      // Integer, not just non-NaN: floor maps to an INT column. A
      // fractional value (?floor=1.5) would pass Prisma the wrong type and
      // surface as a 500 — reject it here as the 400 it actually is.
      if (!Number.isInteger(floor)) {
        return yield* new ValidationError({ message: "'floor' must be an integer" });
      }
      const occupancyService = yield* OccupancyService;
      return yield* occupancyService.latest(buildingId, floor);
    }),
  );
}
