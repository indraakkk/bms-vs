import { now } from "@bms/database";
import { Context, Layer } from "effect";

/**
 * Wraps @bms/database's DEMO_NOW-aware `now()` as an Effect service so
 * QueryService (time-range presets) and OccupancyService (staleness) get
 * it via dependency injection instead of reading process.env directly.
 */
export class ClockService extends Context.Service<
  ClockService,
  { readonly now: () => Date }
>()("ClockService") {
  static readonly layer = Layer.succeed(this, { now });
}
