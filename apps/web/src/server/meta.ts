import { type DataSource, type DbError, type MetaResponse, TABLE_META } from "@bms/contract";
import { Context, Effect, Layer } from "effect";
import { PrismaService, tryDb } from "./prisma";

// A distinct-value list only helps the filter UI if it's short enough to
// scan; above this the value stays a typed input. 24 comfortably covers
// every real categorical in the data (the largest, alarm_type, has 19)
// without turning near-unique columns like device_id into a pick-list.
const FILTER_OPTION_CAP = 24;

/** Distinct values per non-timestamp column, kept only where the column is
 *  low-cardinality enough to present as a dropdown. Values are stringified
 *  (the per-card filter value is a string; the query layer coerces numeric
 *  columns back by dbType), so `floor` yields ["1","2"] and drives a
 *  dropdown just like a categorical. */
export function buildFilterOptions(
  source: DataSource,
  rows: ReadonlyArray<Record<string, unknown>>,
): Record<string, string[]> {
  const cols = TABLE_META[source].filter((c) => !c.isTimestamp).map((c) => c.name);
  const sets = new Map<string, Set<string>>(cols.map((c) => [c, new Set<string>()]));
  for (const row of rows) {
    for (const col of cols) {
      const v = row[col];
      if (v !== null && v !== undefined) sets.get(col)?.add(String(v));
    }
  }
  const options: Record<string, string[]> = {};
  for (const [col, set] of sets) {
    if (set.size > 0 && set.size <= FILTER_OPTION_CAP) {
      options[col] = [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
  }
  return options;
}

export class MetaService extends Context.Service<
  MetaService,
  { readonly get: () => Effect.Effect<MetaResponse, DbError> }
>()("MetaService") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const prisma = yield* PrismaService;

      const get = Effect.fn("MetaService.get")(function* () {
        // One pass over each table (198 rows total) yields both the global
        // building/floor options and every column's distinct filter values.
        const [energy, hvac, occ, alerts] = yield* Effect.all([
          tryDb(() => prisma.energyConsumption.findMany()),
          tryDb(() => prisma.hvacPerformance.findMany()),
          tryDb(() => prisma.occupancy.findMany()),
          tryDb(() => prisma.alertsEvents.findMany()),
        ]);

        // occupancy is the one table guaranteed to cover every
        // building/floor combination (it drives the floor plan's zone
        // matrix), so it's the source of truth for the global filter bar.
        const buildings = [...new Set(occ.map((r) => r.buildingId))].sort();
        const floors = [...new Set(occ.map((r) => r.floor))].sort((a, b) => a - b);

        const filterOptions = {
          energyConsumption: buildFilterOptions("energyConsumption", energy),
          hvacPerformance: buildFilterOptions("hvacPerformance", hvac),
          occupancy: buildFilterOptions("occupancy", occ),
          alertsEvents: buildFilterOptions("alertsEvents", alerts),
        };

        return { tableMeta: TABLE_META, buildings, floors, filterOptions };
      });

      return { get };
    }),
  );
}
