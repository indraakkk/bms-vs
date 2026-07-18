import { describe, expect, test } from "bun:test";
import { GlobalFilters, LoginRequest, QueryRequest } from "@bms/contract";
import { Schema } from "effect";

// These exercise the *decode* edge (what `handleJson` runs before any
// service logic) — the boundary that turns a malformed request into a
// clean 400 instead of letting a bad value reach Prisma and surface as a
// misleading 500. Decoding this beta throws (no decodeUnknownEither), so
// rejection is asserted via `toThrow`, the same path the JSON-import UI
// relies on.
const decodeQuery = Schema.decodeUnknownSync(QueryRequest);
const decodeLogin = Schema.decodeUnknownSync(LoginRequest);
const decodeFilters = Schema.decodeUnknownSync(GlobalFilters);

const allRange = { timeRange: { preset: "all" } };
const kpi = {
  cardType: "kpi",
  source: "energyConsumption",
  metric: "energyKwh",
  aggregation: "sum",
} as const;
const gauge = {
  cardType: "gauge",
  source: "hvacPerformance",
  metric: "actualTempC",
  aggregation: "avg",
  min: 0,
  max: 100,
  target: 50,
} as const;

describe("contract decode: numeric fields reject non-finite / non-integer", () => {
  test("fractional floor is rejected at decode (would otherwise 500 in Prisma)", () => {
    expect(() =>
      decodeFilters({ floor: 1.5, timeRange: { preset: "all" } }),
    ).toThrow();
  });

  test("integer floor decodes fine", () => {
    expect(decodeFilters({ floor: 2, timeRange: { preset: "all" } }).floor).toBe(2);
  });

  test("gauge min/max/target reject NaN and Infinity", () => {
    for (const bad of [
      { ...gauge, min: Number.NaN },
      { ...gauge, max: Number.POSITIVE_INFINITY },
      { ...gauge, target: Number.NEGATIVE_INFINITY },
    ]) {
      expect(() => decodeQuery({ config: bad, globalFilters: allRange })).toThrow();
    }
  });

  test("a well-formed gauge still decodes", () => {
    expect(() =>
      decodeQuery({ config: gauge, globalFilters: allRange }),
    ).not.toThrow();
  });
});

describe("contract decode: string fields are length-bounded", () => {
  test("an over-long login pin is rejected", () => {
    expect(() => decodeLogin({ pin: "x".repeat(129) })).toThrow();
    expect(decodeLogin({ pin: "1234" }).pin).toBe("1234");
  });

  test("an over-long filter value is rejected", () => {
    const longValue = "x".repeat(201);
    expect(() =>
      decodeQuery({
        config: { ...kpi, filter: { column: "zone", value: longValue } },
        globalFilters: allRange,
      }),
    ).toThrow();
  });
});
