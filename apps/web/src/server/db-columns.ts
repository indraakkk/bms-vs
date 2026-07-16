import type { DataSource } from "@bms/contract";

/**
 * Maps TABLE_META's whitelisted camelCase column names to their actual
 * MSSQL table/column names (the Prisma `@@map`/`@map` targets in
 * schema.prisma). QueryService's raw-SQL line-chart path resolves every
 * identifier through this map — never by interpolating a request-derived
 * string directly — so a raw query can only ever reference a column that
 * was already validated against TABLE_META.
 */
export const DB_TABLE: Record<DataSource, string> = {
  energyConsumption: "energy_consumption",
  hvacPerformance: "hvac_performance",
  occupancy: "occupancy",
  alertsEvents: "alerts_events",
};

export const DB_COLUMN: Record<DataSource, Record<string, string>> = {
  energyConsumption: {
    timestamp: "timestamp",
    buildingId: "building_id",
    floor: "floor",
    zone: "zone",
    deviceType: "device_type",
    deviceId: "device_id",
    energyKwh: "energy_kwh",
    powerKw: "power_kw",
    voltageV: "voltage_v",
    currentA: "current_a",
    powerFactor: "power_factor",
    costUsd: "cost_usd",
    sourceSystem: "source_system",
  },
  hvacPerformance: {
    timestamp: "timestamp",
    buildingId: "building_id",
    floor: "floor",
    zone: "zone",
    unitId: "unit_id",
    mode: "mode",
    setpointTempC: "setpoint_temp_c",
    actualTempC: "actual_temp_c",
    outdoorTempC: "outdoor_temp_c",
    humidityPercent: "humidity_percent",
    airflowM3h: "airflow_m3h",
    filterStatusPercent: "filter_status_percent",
    compressorHours: "compressor_hours",
    energyEfficiencyRatio: "energy_efficiency_ratio",
    operatingStatus: "operating_status",
  },
  occupancy: {
    timestamp: "timestamp",
    buildingId: "building_id",
    floor: "floor",
    zone: "zone",
    zoneCapacity: "zone_capacity",
    personCount: "person_count",
    occupancyRatePercent: "occupancy_rate_percent",
    co2Ppm: "co2_ppm",
    temperatureC: "temperature_c",
    humidityPercent: "humidity_percent",
    airQualityIndex: "air_quality_index",
    entryCount: "entry_count",
    exitCount: "exit_count",
  },
  alertsEvents: {
    timestamp: "timestamp",
    buildingId: "building_id",
    floor: "floor",
    zone: "zone",
    alertId: "alert_id",
    severity: "severity",
    category: "category",
    deviceId: "device_id",
    alarmType: "alarm_type",
    description: "description",
    value: "value",
    threshold: "threshold",
    unit: "unit",
    durationMinutes: "duration_minutes",
    resolvedAt: "resolved_at",
    status: "status",
    acknowledgedBy: "acknowledged_by",
  },
};
