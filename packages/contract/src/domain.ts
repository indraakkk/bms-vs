import { Schema } from "effect";

export const DataSource = Schema.Literals([
  "energyConsumption",
  "hvacPerformance",
  "occupancy",
  "alertsEvents",
]);
export type DataSource = typeof DataSource.Type;

export const Aggregation = Schema.Literals(["sum", "avg", "min", "max", "count"]);
export type Aggregation = typeof Aggregation.Type;

export const CardType = Schema.Literals(["kpi", "bar", "line", "gauge"]);
export type CardType = typeof CardType.Type;

/** The column's actual underlying SQL type — used for coercing free-text
 *  filter values to the right JS type before they reach Prisma. Distinct
 *  from `isNumeric` below, which is about aggregation eligibility, not
 *  storage type (see that field's doc comment for why they differ). */
export const DbType = Schema.Literals(["string", "number", "date"]);
export type DbType = typeof DbType.Type;

export interface ColumnMeta {
  readonly name: string;
  readonly label: string;
  readonly isNumeric: boolean;
  readonly isTimestamp: boolean;
  readonly dbType: DbType;
}

/**
 * The server-side whitelist QueryService validates every card config's
 * column references against, AND the exact payload served at
 * `/api/meta` — one definition, two jobs, so the two can't drift.
 *
 * Modeled from the real CSVs in data/, not data/DATA_DICTIONARY.md (they
 * disagree in places — e.g. `category` includes "Lighting" in the data
 * but not the dictionary). `isNumeric` marks columns valid as a card's
 * Y-axis/metric for sum/avg/min/max aggregation; dimension columns
 * (building, zone, device ids, categoricals) are `isNumeric: false` even
 * when their DB type is numeric (e.g. `floor`), since summing a floor
 * number is meaningless — they're still valid for `count` aggregation
 * and for X-axis/groupBy. `dbType` is the independent, always-accurate
 * "what JS type does Prisma expect" fact used for filter-value coercion
 * — `floor` is `dbType: "number"` despite `isNumeric: false`.
 */
export const TABLE_META: Record<DataSource, ReadonlyArray<ColumnMeta>> = {
  energyConsumption: [
    { name: "timestamp", label: "Timestamp", isNumeric: false, isTimestamp: true, dbType: "date" },
    { name: "buildingId", label: "Building", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "floor", label: "Floor", isNumeric: false, isTimestamp: false, dbType: "number" },
    { name: "zone", label: "Zone", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "deviceType", label: "Device Type", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "deviceId", label: "Device ID", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "energyKwh", label: "Energy (kWh)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "powerKw", label: "Power (kW)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "voltageV", label: "Voltage (V)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "currentA", label: "Current (A)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "powerFactor", label: "Power Factor", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "costUsd", label: "Cost (USD)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "sourceSystem", label: "Source System", isNumeric: false, isTimestamp: false, dbType: "string" },
  ],
  hvacPerformance: [
    { name: "timestamp", label: "Timestamp", isNumeric: false, isTimestamp: true, dbType: "date" },
    { name: "buildingId", label: "Building", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "floor", label: "Floor", isNumeric: false, isTimestamp: false, dbType: "number" },
    { name: "zone", label: "Zone", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "unitId", label: "Unit ID", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "mode", label: "Mode", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "setpointTempC", label: "Setpoint Temp (°C)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "actualTempC", label: "Actual Temp (°C)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "outdoorTempC", label: "Outdoor Temp (°C)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "humidityPercent", label: "Humidity (%)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "airflowM3h", label: "Airflow (m³/h)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "filterStatusPercent", label: "Filter Status (%)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "compressorHours", label: "Compressor Hours", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "energyEfficiencyRatio", label: "Energy Efficiency Ratio", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "operatingStatus", label: "Operating Status", isNumeric: false, isTimestamp: false, dbType: "string" },
  ],
  occupancy: [
    { name: "timestamp", label: "Timestamp", isNumeric: false, isTimestamp: true, dbType: "date" },
    { name: "buildingId", label: "Building", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "floor", label: "Floor", isNumeric: false, isTimestamp: false, dbType: "number" },
    { name: "zone", label: "Zone", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "zoneCapacity", label: "Zone Capacity", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "personCount", label: "Person Count", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "occupancyRatePercent", label: "Occupancy Rate (%)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "co2Ppm", label: "CO2 (ppm)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "temperatureC", label: "Temperature (°C)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "humidityPercent", label: "Humidity (%)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "airQualityIndex", label: "Air Quality Index", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "entryCount", label: "Entry Count", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "exitCount", label: "Exit Count", isNumeric: true, isTimestamp: false, dbType: "number" },
  ],
  alertsEvents: [
    { name: "timestamp", label: "Timestamp", isNumeric: false, isTimestamp: true, dbType: "date" },
    { name: "buildingId", label: "Building", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "floor", label: "Floor", isNumeric: false, isTimestamp: false, dbType: "number" },
    { name: "zone", label: "Zone", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "alertId", label: "Alert ID", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "severity", label: "Severity", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "category", label: "Category", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "deviceId", label: "Device ID", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "alarmType", label: "Alarm Type", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "value", label: "Value", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "threshold", label: "Threshold", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "unit", label: "Unit", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "durationMinutes", label: "Duration (min)", isNumeric: true, isTimestamp: false, dbType: "number" },
    { name: "resolvedAt", label: "Resolved At", isNumeric: false, isTimestamp: true, dbType: "date" },
    { name: "status", label: "Status", isNumeric: false, isTimestamp: false, dbType: "string" },
    { name: "acknowledgedBy", label: "Acknowledged By", isNumeric: false, isTimestamp: false, dbType: "string" },
  ],
};

export function findColumn(source: DataSource, column: string): ColumnMeta | undefined {
  return TABLE_META[source].find((c) => c.name === column);
}

/** Shape of GET /api/meta — TABLE_META plus live-queried filter option values. */
export interface MetaResponse {
  readonly tableMeta: Record<DataSource, ReadonlyArray<ColumnMeta>>;
  readonly buildings: ReadonlyArray<string>;
  readonly floors: ReadonlyArray<number>;
  /**
   * Per-source, per-column distinct values for the per-card filter's value
   * picker, so the UI never asks the user to guess a value. Populated only
   * for columns whose distinct count is small enough to be a sensible
   * pick-list (see MetaService's cap) — continuous measures (energyKwh…)
   * and near-unique id columns (deviceId, alertId) are intentionally
   * absent, and the modal falls back to a typed input for those.
   */
  readonly filterOptions: Record<DataSource, Record<string, ReadonlyArray<string>>>;
}
