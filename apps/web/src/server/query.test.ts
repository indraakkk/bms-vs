import { describe, expect, test } from "bun:test";
import type { CardConfig, GlobalFilters } from "@bms/contract";
import type { PrismaClient } from "@bms/database";
import { Effect, Layer } from "effect";
import { ClockService } from "./clock";
import { PrismaService } from "./prisma";
import { QueryService } from "./query";

/** Every test runs against this frozen instant (mid-seed-day, UTC). */
const FIXED_NOW = new Date("2025-06-01T12:00:00.000Z");

const ALL: GlobalFilters = { timeRange: { preset: "all" } };

const kpiSum: CardConfig = {
  cardType: "kpi",
  source: "energyConsumption",
  metric: "energyKwh",
  aggregation: "sum",
};

interface StubResults {
  count?: number;
  aggregate?: Record<string, unknown>;
  groupBy?: Array<Record<string, unknown>>;
  queryRaw?: Array<{ bucket: Date; series: string | null; y: number | null }>;
}

interface RecordedCall {
  model: string;
  method: string;
  args: Record<string, unknown>;
}

/**
 * QueryService over an in-memory Prisma stub: validation, where-building,
 * and result mapping are the service's own logic under test — only the
 * delegate calls (count/aggregate/groupBy/$queryRaw) are faked, recording
 * the exact arguments the service built.
 */
function makeHarness(results: StubResults = {}) {
  const calls: RecordedCall[] = [];
  const model = (name: string) => ({
    count: (args: Record<string, unknown>) => {
      calls.push({ model: name, method: "count", args });
      return Promise.resolve(results.count ?? 0);
    },
    aggregate: (args: Record<string, unknown>) => {
      calls.push({ model: name, method: "aggregate", args });
      // Shape-faithful default: Prisma always returns the requested op
      // key ({_sum: {col: null}}, etc.) even when no rows match.
      const opKeys = Object.keys(args).filter((k) => k.startsWith("_"));
      return Promise.resolve(
        results.aggregate ?? Object.fromEntries(opKeys.map((k) => [k, {}])),
      );
    },
    groupBy: (args: Record<string, unknown>) => {
      calls.push({ model: name, method: "groupBy", args });
      return Promise.resolve(results.groupBy ?? []);
    },
  });
  const prismaStub = {
    energyConsumption: model("energyConsumption"),
    hvacPerformance: model("hvacPerformance"),
    occupancy: model("occupancy"),
    alertsEvents: model("alertsEvents"),
    $queryRaw: (...args: unknown[]) => {
      calls.push({ model: "$queryRaw", method: "$queryRaw", args: { sql: args[0] } });
      return Promise.resolve(results.queryRaw ?? []);
    },
  };

  const layer = QueryService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(PrismaService, prismaStub as unknown as PrismaClient),
        Layer.succeed(ClockService, { now: () => FIXED_NOW }),
      ),
    ),
  );

  const execute = (config: CardConfig, filters: GlobalFilters = ALL) =>
    Effect.gen(function* () {
      const query = yield* QueryService;
      return yield* query.execute(config, filters);
    }).pipe(Effect.provide(layer));

  const lastWhere = () => calls[calls.length - 1].args.where as Record<string, unknown>;

  return { calls, execute, lastWhere };
}

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);
/** Runs an effect expected to fail and resolves with its typed error. */
const runFail = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.flip(effect));

describe("QueryService validation", () => {
  test("rejects a column that isn't in TABLE_META, naming the allowed list", async () => {
    const { execute, calls } = makeHarness();
    const error = await runFail(execute({ ...kpiSum, metric: "notAColumn" }));
    expect(error._tag).toBe("UnknownColumnError");
    if (error._tag === "UnknownColumnError") {
      expect(error.column).toBe("notAColumn");
      expect(error.allowed).toContain("energyKwh");
    }
    expect(calls).toHaveLength(0); // rejected before any DB call
  });

  test("rejects sum/avg/min/max over a non-numeric column", async () => {
    const { execute } = makeHarness();
    const error = await runFail(execute({ ...kpiSum, metric: "zone" }));
    expect(error._tag).toBe("ValidationError");
    expect(String(error.message)).toContain("not numeric");
  });

  test('allows "count" over a non-numeric column', async () => {
    const { execute, calls } = makeHarness({ count: 42 });
    const response = await run(execute({ ...kpiSum, metric: "zone", aggregation: "count" }));
    expect(response.rows).toEqual([{ x: "zone", y: 42 }]);
    expect(calls[0].method).toBe("count");
  });

  test("rejects a gauge whose min is not below max", async () => {
    const { execute } = makeHarness();
    const error = await runFail(
      execute({
        cardType: "gauge",
        source: "hvacPerformance",
        metric: "actualTempC",
        aggregation: "avg",
        min: 30,
        max: 30,
        target: 30,
      }),
    );
    expect(error._tag).toBe("ValidationError");
    expect(String(error.message)).toContain("min");
  });

  test("rejects a line chart whose x-axis is not a timestamp column", async () => {
    const { execute } = makeHarness();
    const error = await runFail(
      execute({
        cardType: "line",
        source: "energyConsumption",
        x: "zone",
        y: "energyKwh",
        aggregation: "sum",
      }),
    );
    expect(error._tag).toBe("ValidationError");
    expect(String(error.message)).toContain("timestamp");
  });

  test("rejects a per-card filter on a timestamp column", async () => {
    const { execute } = makeHarness();
    const error = await runFail(
      execute({ ...kpiSum, filter: { column: "timestamp", value: "2025-06-01" } }),
    );
    expect(error._tag).toBe("ValidationError");
    expect(String(error.message)).toContain("global time range");
  });

  test("rejects an empty per-card filter value", async () => {
    const { execute } = makeHarness();
    const error = await runFail(execute({ ...kpiSum, filter: { column: "zone", value: "  " } }));
    expect(error._tag).toBe("ValidationError");
    expect(String(error.message)).toContain("must not be empty");
  });

  test("rejects a non-numeric filter value on a numeric column", async () => {
    const { execute } = makeHarness();
    const error = await runFail(execute({ ...kpiSum, filter: { column: "floor", value: "abc" } }));
    expect(error._tag).toBe("ValidationError");
    expect(String(error.message)).toContain("is not a number");
  });

  test('rejects a custom time range missing "from"/"to"', async () => {
    const { execute } = makeHarness();
    const error = await runFail(execute(kpiSum, { timeRange: { preset: "custom" } }));
    expect(error._tag).toBe("ValidationError");
  });

  test("rejects unparseable custom time range bounds", async () => {
    const { execute } = makeHarness();
    const error = await runFail(
      execute(kpiSum, { timeRange: { preset: "custom", from: "banana", to: "2025-06-02" } }),
    );
    expect(error._tag).toBe("ValidationError");
    expect(String(error.message)).toContain("ISO-8601");
  });

  test('rejects a custom range whose "from" is after "to"', async () => {
    const { execute } = makeHarness();
    const error = await runFail(
      execute(kpiSum, {
        timeRange: { preset: "custom", from: "2025-06-02T00:00:00Z", to: "2025-06-01T00:00:00Z" },
      }),
    );
    expect(error._tag).toBe("ValidationError");
    expect(String(error.message)).toContain("must not be after");
  });
});

describe("QueryService aggregation result mapping", () => {
  test("kpi sum maps the aggregate value onto a single row", async () => {
    const { execute, calls } = makeHarness({ aggregate: { _sum: { energyKwh: 123.45 } } });
    const response = await run(execute(kpiSum));
    expect(response.rows).toEqual([{ x: "energyKwh", y: 123.45 }]);
    expect(response.meta.rowCount).toBe(1);
    expect(calls[0].args._sum).toEqual({ energyKwh: true });
  });

  test("a null aggregate (no matching rows) maps to 0, not a crash", async () => {
    const { execute } = makeHarness({ aggregate: { _sum: { energyKwh: null } } });
    const response = await run(execute(kpiSum));
    expect(response.rows).toEqual([{ x: "energyKwh", y: 0 }]);
  });

  test("bar avg maps each group's aggregate, nulls to 0", async () => {
    const { execute } = makeHarness({
      groupBy: [
        { zone: "Zone-A", _avg: { co2Ppm: 512 } },
        { zone: "Zone-B", _avg: { co2Ppm: null } },
      ],
    });
    const response = await run(
      execute({
        cardType: "bar",
        source: "occupancy",
        x: "zone",
        y: "co2Ppm",
        aggregation: "avg",
      }),
    );
    expect(response.rows).toEqual([
      { x: "Zone-A", y: 512 },
      { x: "Zone-B", y: 0 },
    ]);
  });

  test("bar count maps _count._all and always counts rows", async () => {
    const { execute, calls } = makeHarness({
      groupBy: [{ severity: "Critical", _count: { _all: 4 } }],
    });
    const response = await run(
      execute({
        cardType: "bar",
        source: "alertsEvents",
        x: "severity",
        y: "severity",
        aggregation: "count",
      }),
    );
    expect(response.rows).toEqual([{ x: "Critical", y: 4 }]);
    expect(calls[0].args._count).toEqual({ _all: true });
  });

  test("line buckets map to ISO strings; null y → 0, null series → undefined", async () => {
    const { execute, calls } = makeHarness({
      queryRaw: [
        { bucket: new Date("2025-06-01T08:00:00.000Z"), series: null, y: 10.5 },
        { bucket: new Date("2025-06-01T09:00:00.000Z"), series: "HVAC", y: null },
      ],
    });
    const response = await run(
      execute({
        cardType: "line",
        source: "energyConsumption",
        x: "timestamp",
        y: "energyKwh",
        aggregation: "sum",
        groupBy: "deviceType",
      }),
    );
    expect(calls[0].model).toBe("$queryRaw");
    expect(response.rows).toEqual([
      { x: "2025-06-01T08:00:00.000Z", y: 10.5, series: undefined },
      { x: "2025-06-01T09:00:00.000Z", y: 0, series: "HVAC" },
    ]);
  });
});

describe("QueryService filter → where building", () => {
  test("global building + floor filters land in the where clause", async () => {
    const { execute, lastWhere } = makeHarness();
    await run(execute(kpiSum, { buildingId: "BLD-001", floor: 2, timeRange: { preset: "all" } }));
    expect(lastWhere()).toEqual({ buildingId: "BLD-001", floor: 2 });
  });

  test('"all" preset adds no timestamp range', async () => {
    const { execute, lastWhere } = makeHarness();
    await run(execute(kpiSum));
    expect(lastWhere().timestamp).toBeUndefined();
  });

  test('"today" resolves to the clock\'s UTC calendar day', async () => {
    const { execute, lastWhere } = makeHarness();
    await run(execute(kpiSum, { timeRange: { preset: "today" } }));
    const range = lastWhere().timestamp as { gte: Date; lte: Date };
    expect(range.gte.toISOString()).toBe("2025-06-01T00:00:00.000Z");
    expect(range.lte.toISOString()).toBe("2025-06-02T00:00:00.000Z");
  });

  test('"last7d" resolves to a trailing 7-day window ending now', async () => {
    const { execute, lastWhere } = makeHarness();
    await run(execute(kpiSum, { timeRange: { preset: "last7d" } }));
    const range = lastWhere().timestamp as { gte: Date; lte: Date };
    expect(range.gte.toISOString()).toBe("2025-05-25T12:00:00.000Z");
    expect(range.lte.toISOString()).toBe(FIXED_NOW.toISOString());
  });

  test("custom range bounds parse into the where clause verbatim", async () => {
    const { execute, lastWhere } = makeHarness();
    await run(
      execute(kpiSum, {
        timeRange: {
          preset: "custom",
          from: "2025-06-01T00:00:00.000Z",
          to: "2025-06-01T23:59:59.999Z",
        },
      }),
    );
    const range = lastWhere().timestamp as { gte: Date; lte: Date };
    expect(range.gte.toISOString()).toBe("2025-06-01T00:00:00.000Z");
    expect(range.lte.toISOString()).toBe("2025-06-01T23:59:59.999Z");
  });

  test("per-card filter values coerce by the column's dbType, not isNumeric", async () => {
    // `floor` is isNumeric:false (not aggregatable) but dbType:"number" —
    // the filter must reach Prisma as a number, not a string.
    const { execute, lastWhere } = makeHarness();
    await run(execute({ ...kpiSum, filter: { column: "floor", value: "2" } }));
    expect(lastWhere().floor).toBe(2);
  });

  test("per-card filter on a string column stays a string", async () => {
    const { execute, lastWhere } = makeHarness();
    await run(execute({ ...kpiSum, filter: { column: "zone", value: "Zone-A" } }));
    expect(lastWhere().zone).toBe("Zone-A");
  });
});
