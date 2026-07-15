import { SqlClient } from "@effect/sql";
import { Effect } from "effect";

/**
 * Forces readings_hourly_rollup (a Timescale continuous aggregate, see
 * 0001_init.sql) to materialize immediately over [since, now). The
 * scheduled policy (0002_rollup_policy.sql) keeps it fresh on its own in
 * steady state; this is only needed right after a bulk load (e.g. seed.ts)
 * so the API doesn't wait up to an hour for the first scheduled refresh.
 *
 * CALL runs its own transaction internally — must not be wrapped in one.
 */
export const refreshHourlyRollup = (since: Date) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CALL refresh_continuous_aggregate('readings_hourly_rollup', ${since}::timestamptz, NULL::timestamptz)`;
  });
