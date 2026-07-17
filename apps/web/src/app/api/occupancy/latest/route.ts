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
      if (Number.isNaN(floor)) {
        return yield* new ValidationError({ message: "'floor' must be a number" });
      }
      const occupancyService = yield* OccupancyService;
      return yield* occupancyService.latest(buildingId, floor);
    }),
  );
}
