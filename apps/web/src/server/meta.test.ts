import { describe, expect, test } from "bun:test";
import { buildFilterOptions } from "./meta";

// The per-card filter value picker only helps if it offers real, scannable
// values. buildFilterOptions is the gate: low-cardinality columns become a
// dropdown; continuous measures and near-unique ids stay a typed input.
describe("buildFilterOptions", () => {
  // 30 energy rows: some columns are low-cardinality (dropdown-worthy),
  // others are unique-per-row or continuous (must be excluded, >24 cap).
  const rows = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    timestamp: new Date("2025-06-01T00:00:00Z"),
    buildingId: "BLD-001",
    floor: i % 2 === 0 ? 1 : 2,
    zone: i % 2 === 0 ? "Zone-A" : "Zone-B",
    deviceType: "HVAC",
    deviceId: `DEV-${i}`, // 30 distinct → over cap
    energyKwh: i * 1.5, // 30 distinct → over cap
    powerKw: 10,
    voltageV: 220,
    currentA: 5,
    powerFactor: 0.9,
    costUsd: 1,
    sourceSystem: i % 2 === 0 ? "SCADA" : "Modbus",
  }));

  const opts = buildFilterOptions("energyConsumption", rows);

  test("low-cardinality categorical columns become sorted value lists", () => {
    expect(opts.sourceSystem).toEqual(["Modbus", "SCADA"]);
    expect(opts.buildingId).toEqual(["BLD-001"]);
    expect(opts.zone).toEqual(["Zone-A", "Zone-B"]);
  });

  test("a numeric dimension (floor) is offered as a numeric-sorted list", () => {
    // stringified for the filter value, numeric-collated so 2 sorts before 10
    expect(opts.floor).toEqual(["1", "2"]);
  });

  test("continuous measures and near-unique ids are excluded (over the cap)", () => {
    expect(opts.energyKwh).toBeUndefined();
    expect(opts.deviceId).toBeUndefined();
  });

  test("timestamp columns are never offered as a filter value", () => {
    expect(opts.timestamp).toBeUndefined();
  });

  test("null / undefined cell values are skipped, not stringified", () => {
    const withNulls = buildFilterOptions("alertsEvents", [
      { severity: "Critical", acknowledgedBy: "John" },
      { severity: "Warning", acknowledgedBy: null },
      { severity: "Info", acknowledgedBy: undefined },
    ]);
    expect(withNulls.severity).toEqual(["Critical", "Info", "Warning"]);
    expect(withNulls.acknowledgedBy).toEqual(["John"]);
  });
});
