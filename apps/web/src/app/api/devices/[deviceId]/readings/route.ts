import { DbLive, detectAnomalies, getRollupSeries } from "@venturesea/data";
import { Effect } from "effect";
import { NextResponse, type NextRequest } from "next/server";

// Never scans raw readings — always reads the hourly rollup, which is the
// only shape that stays cheap at building scale (thousands of points,
// years of history). Raw-reading drill-down would be a separate endpoint.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/devices/[deviceId]/readings">,
) {
  const { deviceId } = await ctx.params;
  const searchParams = request.nextUrl.searchParams;

  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date();
  const from = searchParams.get("from")
    ? new Date(searchParams.get("from")!)
    : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

  const program = Effect.gen(function* () {
    const points = yield* getRollupSeries(deviceId, from, to);
    return detectAnomalies(points);
  });

  const result = await Effect.runPromise(program.pipe(Effect.provide(DbLive)));

  return NextResponse.json({ deviceId, from, to, points: result });
}
