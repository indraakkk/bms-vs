import { Schema } from "effect";
import { Aggregation, CardType, DataSource } from "./domain";

const CardFilter = Schema.Struct({
  column: Schema.String,
  // A filter value reaches the server and becomes a WHERE-clause literal.
  // Cap its length so a hand-crafted request (or a tampered import) can't
  // push an unbounded string through decode into the query path.
  value: Schema.String.check(Schema.isMaxLength(200)),
});

const KpiCardConfig = Schema.Struct({
  cardType: Schema.Literal("kpi"),
  source: DataSource,
  metric: Schema.String,
  aggregation: Aggregation,
  filter: Schema.optional(CardFilter),
});

const BarCardConfig = Schema.Struct({
  cardType: Schema.Literal("bar"),
  source: DataSource,
  x: Schema.String,
  y: Schema.String,
  aggregation: Aggregation,
  filter: Schema.optional(CardFilter),
});

const LineCardConfig = Schema.Struct({
  cardType: Schema.Literal("line"),
  source: DataSource,
  x: Schema.String,
  y: Schema.String,
  aggregation: Aggregation,
  groupBy: Schema.optional(Schema.String),
  filter: Schema.optional(CardFilter),
});

const GaugeCardConfig = Schema.Struct({
  cardType: Schema.Literal("gauge"),
  source: DataSource,
  metric: Schema.String,
  aggregation: Aggregation,
  // Finite, not bare Number: reject NaN / ±Infinity (and, via a tampered
  // import, absurd bounds) at the schema edge so the gauge min<max check
  // downstream compares real numbers — NaN >= NaN is false, so a NaN bound
  // would otherwise slip past that check and render a broken gauge.
  min: Schema.Finite,
  max: Schema.Finite,
  target: Schema.Finite,
  filter: Schema.optional(CardFilter),
});

/**
 * Discriminated on `cardType`. Each variant carries exactly the fields
 * that card type needs to build a query: kpi/gauge need a single
 * metric+aggregation, bar/line need an x+y pair, line additionally takes
 * an optional groupBy (series) and its x is expected to be a
 * `isTimestamp` column (validated server-side against TABLE_META, not
 * encoded in the type).
 */
export const CardConfig = Schema.Union([
  KpiCardConfig,
  BarCardConfig,
  LineCardConfig,
  GaugeCardConfig,
]);
export type CardConfig = typeof CardConfig.Type;

/**
 * A card as persisted in the dashboard: known cardType from the moment
 * it's dragged off the palette, `config: null` until the config modal is
 * saved. Unconfigured cards render "Configure this card" and never fire
 * a query.
 */
export const DashboardCard = Schema.Struct({
  id: Schema.String,
  cardType: CardType,
  // Bounded so an imported/hand-edited dashboard can't carry an
  // unbounded title into React render + localStorage persistence.
  title: Schema.String.check(Schema.isMaxLength(120)),
  config: Schema.NullOr(CardConfig),
});
export type DashboardCard = typeof DashboardCard.Type;

const GridLayoutItem = Schema.Struct({
  i: Schema.String,
  x: Schema.Number,
  y: Schema.Number,
  w: Schema.Number,
  h: Schema.Number,
});
export type GridLayoutItem = typeof GridLayoutItem.Type;

export const DashboardState = Schema.Struct({
  cards: Schema.Array(DashboardCard),
  layout: Schema.Array(GridLayoutItem),
});
export type DashboardState = typeof DashboardState.Type;

const TimeRangePreset = Schema.Literals(["today", "last7d", "custom", "all"]);
export type TimeRangePreset = typeof TimeRangePreset.Type;

export const GlobalFilters = Schema.Struct({
  buildingId: Schema.optional(Schema.String),
  // Int, not Number: the DB column is INT. A fractional floor (1.5) would
  // otherwise decode fine, reach Prisma, and fail deep in the driver as a
  // 500 — this rejects it at the edge as the 400 it actually is.
  floor: Schema.optional(Schema.Int),
  timeRange: Schema.Struct({
    preset: TimeRangePreset,
    from: Schema.optional(Schema.String),
    to: Schema.optional(Schema.String),
  }),
});
export type GlobalFilters = typeof GlobalFilters.Type;

export const QueryRequest = Schema.Struct({
  config: CardConfig,
  globalFilters: GlobalFilters,
});
export type QueryRequest = typeof QueryRequest.Type;

const QueryRow = Schema.Struct({
  x: Schema.Union([Schema.String, Schema.Number]),
  y: Schema.Number,
  series: Schema.optional(Schema.String),
});
export type QueryRow = typeof QueryRow.Type;

export const QueryResponse = Schema.Struct({
  rows: Schema.Array(QueryRow),
  meta: Schema.Struct({
    rowCount: Schema.Number,
    executedInMs: Schema.Number,
  }),
});
export type QueryResponse = typeof QueryResponse.Type;

const ZoneOccupancy = Schema.Struct({
  buildingId: Schema.String,
  floor: Schema.Number,
  zone: Schema.String,
  occupancyRatePercent: Schema.Number,
  personCount: Schema.Number,
  zoneCapacity: Schema.Number,
  co2Ppm: Schema.Number,
  airQualityIndex: Schema.Number,
  temperatureC: Schema.Number,
  timestamp: Schema.String,
  isStale: Schema.Boolean,
});
export type ZoneOccupancy = typeof ZoneOccupancy.Type;

export const OccupancyLatestResponse = Schema.Struct({
  zones: Schema.Array(ZoneOccupancy),
});
export type OccupancyLatestResponse = typeof OccupancyLatestResponse.Type;

export const LoginRequest = Schema.Struct({
  // Capped so login can't be fed an unbounded string (the constant-time
  // compare and any hashing should never run over attacker-sized input).
  pin: Schema.String.check(Schema.isMaxLength(128)),
});
export type LoginRequest = typeof LoginRequest.Type;
