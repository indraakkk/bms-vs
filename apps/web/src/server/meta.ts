import { type MetaResponse, TABLE_META } from "@bms/contract";
import { Context, Effect, Layer } from "effect";
import { PrismaService } from "./prisma";

export class MetaService extends Context.Service<
  MetaService,
  { readonly get: () => Effect.Effect<MetaResponse> }
>()("MetaService") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const prisma = yield* PrismaService;

      const get = Effect.fn("MetaService.get")(function* () {
        // occupancy is the one table guaranteed to cover every
        // building/floor combination (it drives the floor plan's zone
        // matrix), so it's the source of truth for these filter options.
        const rows = yield* Effect.promise(() =>
          prisma.occupancy.findMany({
            select: { buildingId: true, floor: true },
            distinct: ["buildingId", "floor"],
          }),
        );
        const buildings = [...new Set(rows.map((r) => r.buildingId))].sort();
        const floors = [...new Set(rows.map((r) => r.floor))].sort((a, b) => a - b);
        return { tableMeta: TABLE_META, buildings, floors };
      });

      return { get };
    }),
  );
}
