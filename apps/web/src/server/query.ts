import {
  type Aggregation,
  type CardConfig,
  type ColumnMeta,
  type DataSource,
  findColumn,
  type GlobalFilters,
  type QueryResponse,
  TABLE_META,
  UnknownColumnError,
  ValidationError,
} from "@bms/contract";
import { Prisma, type PrismaClient } from "@bms/database";
import { Context, Effect, Layer } from "effect";
import { ClockService } from "./clock";
import { DB_COLUMN, DB_TABLE } from "./db-columns";
import { PrismaService } from "./prisma";

const checkColumn = Effect.fn("QueryService.checkColumn")(function* (
  source: DataSource,
  column: string,
) {
  const meta = findColumn(source, column);
  if (!meta) {
    return yield* Effect.fail(
      new UnknownColumnError({
        source,
        column,
        allowed: TABLE_META[source].map((c) => c.name),
      }),
    );
  }
  return meta;
});

const requireNumericOrCount = Effect.fn("QueryService.requireNumericOrCount")(
  function* (meta: ColumnMeta, aggregation: Aggregation) {
    if (aggregation !== "count" && !meta.isNumeric) {
      return yield* Effect.fail(
        new ValidationError({
          message: `Column "${meta.name}" is not numeric — only "count" aggregation is valid for non-numeric columns`,
        }),
      );
    }
  },
);

const validateConfig = Effect.fn("QueryService.validateConfig")(function* (
  config: CardConfig,
) {
  switch (config.cardType) {
    case "kpi":
    case "gauge": {
      const meta = yield* checkColumn(config.source, config.metric);
      yield* requireNumericOrCount(meta, config.aggregation);
      if (config.cardType === "gauge" && config.min >= config.max) {
        yield* Effect.fail(
          new ValidationError({ message: "Gauge min must be less than max" }),
        );
      }
      break;
    }
    case "bar": {
      yield* checkColumn(config.source, config.x);
      const yMeta = yield* checkColumn(config.source, config.y);
      yield* requireNumericOrCount(yMeta, config.aggregation);
      break;
    }
    case "line": {
      const xMeta = yield* checkColumn(config.source, config.x);
      if (!xMeta.isTimestamp) {
        yield* Effect.fail(
          new ValidationError({
            message: `Line chart X column "${config.x}" must be a timestamp column`,
          }),
        );
      }
      const yMeta = yield* checkColumn(config.source, config.y);
      yield* requireNumericOrCount(yMeta, config.aggregation);
      if (config.groupBy) {
        yield* checkColumn(config.source, config.groupBy);
      }
      break;
    }
  }
  if (config.filter) {
    const filterMeta = yield* checkColumn(config.source, config.filter.column);
    if (filterMeta.isTimestamp) {
      // A timestamp column here would silently overwrite the
      // {gte,lte} range buildWhere already derives from the global
      // time-range filter — equality-matching an exact instant isn't a
      // sensible per-card filter anyway, so it's rejected outright
      // rather than merged.
      yield* Effect.fail(
        new ValidationError({
          message: `Column "${config.filter.column}" is a timestamp — use the global time range filter instead of a per-card filter`,
        }),
      );
    }
  }
});

const validateGlobalFilters = Effect.fn(
  "QueryService.validateGlobalFilters",
)(function* (globalFilters: GlobalFilters) {
  if (
    globalFilters.timeRange.preset === "custom" &&
    (!globalFilters.timeRange.from || !globalFilters.timeRange.to)
  ) {
    yield* Effect.fail(
      new ValidationError({
        message: '"custom" time range requires both "from" and "to"',
      }),
    );
  }
});

function resolveTimeRange(
  timeRange: GlobalFilters["timeRange"],
  now: Date,
): { from: Date; to: Date } | null {
  switch (timeRange.preset) {
    case "all":
      return null;
    case "today": {
      const from = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
    }
    case "last7d":
      return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
    case "custom":
      return { from: new Date(timeRange.from!), to: new Date(timeRange.to!) };
  }
}

function coerceFilterValue(source: DataSource, column: string, value: string) {
  // dbType, not isNumeric — isNumeric is about aggregation eligibility
  // (e.g. `floor` is deliberately isNumeric:false despite being a real
  // Int column) and using it here would send a string where Prisma
  // expects a number for any such column.
  return findColumn(source, column)?.dbType === "number" ? Number(value) : value;
}

function buildWhere(
  config: CardConfig,
  globalFilters: GlobalFilters,
  now: Date,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (globalFilters.buildingId) where.buildingId = globalFilters.buildingId;
  if (globalFilters.floor !== undefined) where.floor = globalFilters.floor;

  const range = resolveTimeRange(globalFilters.timeRange, now);
  if (range) where.timestamp = { gte: range.from, lte: range.to };

  if (config.filter) {
    where[config.filter.column] = coerceFilterValue(
      config.source,
      config.filter.column,
      config.filter.value,
    );
  }
  return where;
}

/** Dynamic dispatch onto one of the four generated model delegates,
 *  selected from a value already validated against DataSource's literal
 *  union — Prisma's generated types don't (and can't cleanly) express
 *  "one of these four delegates, picked at runtime", so this is the one
 *  deliberate `any` boundary in the query path. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic delegate dispatch, see comment above
function delegate(prisma: PrismaClient, source: DataSource): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[source];
}

const runAggregate = Effect.fn("QueryService.runAggregate")(function* (
  prisma: PrismaClient,
  source: DataSource,
  metric: string,
  aggregation: Aggregation,
  where: Record<string, unknown>,
) {
  if (aggregation === "count") {
    return yield* Effect.promise(
      (): Promise<number> => delegate(prisma, source).count({ where }),
    );
  }
  const opKey = `_${aggregation}`;
  const result = yield* Effect.promise(
    (): Promise<Record<string, Record<string, number | null>>> =>
      delegate(prisma, source).aggregate({ where, [opKey]: { [metric]: true } }),
  );
  return result[opKey][metric] ?? 0;
});

const runGroupBy = Effect.fn("QueryService.runGroupBy")(function* (
  prisma: PrismaClient,
  source: DataSource,
  x: string,
  y: string,
  aggregation: Aggregation,
  where: Record<string, unknown>,
) {
  const opArgs =
    aggregation === "count"
      ? { _count: { _all: true } }
      : { [`_${aggregation}`]: { [y]: true } };
  const groups = yield* Effect.promise(
    (): Promise<Array<Record<string, unknown>>> =>
      delegate(prisma, source).groupBy({ by: [x], where, ...opArgs }),
  );
  return groups.map((g) => ({
    x: g[x] as string | number,
    y:
      aggregation === "count"
        ? ((g._count as { _all: number })._all)
        : (((g[`_${aggregation}`] as Record<string, number | null>)[y]) ?? 0),
  }));
});

interface LineRow {
  bucket: Date;
  series: string | null;
  y: number | null;
}

const runLineQuery = Effect.fn("QueryService.runLineQuery")(function* (
  prisma: PrismaClient,
  source: DataSource,
  x: string,
  y: string,
  aggregation: Aggregation,
  groupBy: string | undefined,
  where: Record<string, unknown>,
) {
  const table = Prisma.raw(`[${DB_TABLE[source]}]`);
  const xCol = Prisma.raw(`[${DB_COLUMN[source][x]}]`);
  const yCol = Prisma.raw(`[${DB_COLUMN[source][y]}]`);
  const yAggFn = Prisma.raw(aggregation === "count" ? "COUNT" : aggregation.toUpperCase());
  const seriesCol = groupBy
    ? Prisma.raw(`, [${DB_COLUMN[source][groupBy]}] AS series`)
    : Prisma.raw(", NULL AS series");
  const groupByClause = groupBy
    ? Prisma.raw(`, [${DB_COLUMN[source][groupBy]}]`)
    : Prisma.empty;

  const whereClauses: Prisma.Sql[] = [
    // x is the bucketing column — a NULL here (e.g. alerts_events'
    // nullable resolvedAt used as a line-chart x-axis) would otherwise
    // group into a bogus "NULL bucket" and crash the response mapping
    // below, which assumes every row has a real Date.
    Prisma.sql`${xCol} IS NOT NULL`,
  ];
  if (where.buildingId) {
    whereClauses.push(Prisma.sql`[building_id] = ${where.buildingId}`);
  }
  if (where.floor !== undefined) {
    whereClauses.push(Prisma.sql`[floor] = ${where.floor}`);
  }
  if (where.timestamp) {
    const range = where.timestamp as { gte: Date; lte: Date };
    whereClauses.push(Prisma.sql`${xCol} >= ${range.gte} AND ${xCol} <= ${range.lte}`);
  }
  const filterEntries = Object.entries(where).filter(
    ([k]) => !["buildingId", "floor", "timestamp"].includes(k),
  );
  for (const [col, value] of filterEntries) {
    whereClauses.push(Prisma.sql`[${Prisma.raw(DB_COLUMN[source][col])}] = ${value}`);
  }
  const whereSql =
    whereClauses.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(whereClauses, " AND ")}`
      : Prisma.empty;

  const yArg = aggregation === "count" ? Prisma.raw("*") : yCol;
  const rows = yield* Effect.promise(() =>
    prisma.$queryRaw<LineRow[]>(
      Prisma.sql`SELECT DATETRUNC(hour, ${xCol}) AS bucket, ${yAggFn}(${yArg}) AS y${seriesCol}
        FROM ${table}
        ${whereSql}
        GROUP BY DATETRUNC(hour, ${xCol})${groupByClause}
        ORDER BY bucket ASC`,
    ),
  );

  return rows.map((r) => ({
    x: r.bucket.toISOString(),
    y: r.y ?? 0,
    series: r.series ?? undefined,
  }));
});

export class QueryService extends Context.Service<
  QueryService,
  {
    readonly execute: (
      config: CardConfig,
      globalFilters: GlobalFilters,
    ) => Effect.Effect<QueryResponse, ValidationError | UnknownColumnError>;
  }
>()("QueryService") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const clock = yield* ClockService;

      const execute = Effect.fn("QueryService.execute")(function* (
        config: CardConfig,
        globalFilters: GlobalFilters,
      ) {
        const start = performance.now();
        yield* validateConfig(config);
        yield* validateGlobalFilters(globalFilters);

        const now = clock.now();
        const where = buildWhere(config, globalFilters, now);

        const rows = yield* (() => {
          switch (config.cardType) {
            case "kpi":
            case "gauge":
              return runAggregate(
                prisma,
                config.source,
                config.metric,
                config.aggregation,
                where,
              ).pipe(
                Effect.map((value) => [{ x: config.metric, y: value }]),
              );
            case "bar":
              return runGroupBy(
                prisma,
                config.source,
                config.x,
                config.y,
                config.aggregation,
                where,
              );
            case "line":
              return runLineQuery(
                prisma,
                config.source,
                config.x,
                config.y,
                config.aggregation,
                config.groupBy,
                where,
              );
          }
        })();

        return {
          rows,
          meta: {
            rowCount: rows.length,
            executedInMs: Math.round(performance.now() - start),
          },
        };
      });

      return { execute };
    }),
  );
}
