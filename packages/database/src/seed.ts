import { join } from "node:path";
import Papa from "papaparse";
import { createPrismaClient } from "./index";

const dataDir = join(import.meta.dir, "../../../data");

const EXPECTED_COUNTS = {
  energyConsumption: 80,
  hvacPerformance: 35,
  occupancy: 63,
  alertsEvents: 20,
} as const;

const CHUNK_SIZE = 50;

function toUtcDate(timestamp: string): Date {
  return new Date(`${timestamp.replace(" ", "T")}Z`);
}

function toNullableUtcDate(timestamp: string): Date | null {
  return timestamp === "" ? null : toUtcDate(timestamp);
}

async function parseCsv<T>(filename: string): Promise<Record<string, string>[]> {
  const text = await Bun.file(join(dataDir, filename)).text();
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (result.errors.length > 0) {
    throw new Error(
      `Failed to parse ${filename}: ${JSON.stringify(result.errors)}`,
    );
  }
  return result.data;
}

async function chunkedCreateMany<T>(
  label: string,
  rows: T[],
  create: (chunk: T[]) => Promise<{ count: number }>,
) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const result = await create(chunk);
    inserted += result.count;
  }
  console.log(`  ${label}: inserted ${inserted} rows`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const prisma = createPrismaClient(databaseUrl);

  console.log("Parsing CSVs...");
  const [energyRows, hvacRows, occupancyRows, alertsRows] = await Promise.all([
    parseCsv("energy_consumption.csv"),
    parseCsv("hvac_performance.csv"),
    parseCsv("occupancy.csv"),
    parseCsv("alerts_events.csv"),
  ]);

  console.log("Clearing existing rows (idempotent reseed)...");
  await prisma.$transaction([
    prisma.energyConsumption.deleteMany(),
    prisma.hvacPerformance.deleteMany(),
    prisma.occupancy.deleteMany(),
    prisma.alertsEvents.deleteMany(),
  ]);

  console.log("Seeding...");
  await prisma.$transaction(async (tx) => {
    await chunkedCreateMany(
      "energy_consumption",
      energyRows.map((r) => ({
        timestamp: toUtcDate(r.timestamp),
        buildingId: r.building_id,
        floor: Number(r.floor),
        zone: r.zone,
        deviceType: r.device_type,
        deviceId: r.device_id,
        energyKwh: Number(r.energy_kwh),
        powerKw: Number(r.power_kw),
        voltageV: Number(r.voltage_v),
        currentA: Number(r.current_a),
        powerFactor: Number(r.power_factor),
        costUsd: Number(r.cost_usd),
        sourceSystem: r.source_system,
      })),
      (chunk) => tx.energyConsumption.createMany({ data: chunk }),
    );

    await chunkedCreateMany(
      "hvac_performance",
      hvacRows.map((r) => ({
        timestamp: toUtcDate(r.timestamp),
        buildingId: r.building_id,
        floor: Number(r.floor),
        zone: r.zone,
        unitId: r.unit_id,
        mode: r.mode,
        setpointTempC: Number(r.setpoint_temp_c),
        actualTempC: Number(r.actual_temp_c),
        outdoorTempC: Number(r.outdoor_temp_c),
        humidityPercent: Number(r.humidity_percent),
        airflowM3h: Number(r.airflow_m3h),
        filterStatusPercent: Number(r.filter_status_percent),
        compressorHours: Number(r.compressor_hours),
        energyEfficiencyRatio: Number(r.energy_efficiency_ratio),
        operatingStatus: r.operating_status,
      })),
      (chunk) => tx.hvacPerformance.createMany({ data: chunk }),
    );

    await chunkedCreateMany(
      "occupancy",
      occupancyRows.map((r) => ({
        timestamp: toUtcDate(r.timestamp),
        buildingId: r.building_id,
        floor: Number(r.floor),
        zone: r.zone,
        zoneCapacity: Number(r.zone_capacity),
        personCount: Number(r.person_count),
        occupancyRatePercent: Number(r.occupancy_rate_percent),
        co2Ppm: Number(r.co2_ppm),
        temperatureC: Number(r.temperature_c),
        humidityPercent: Number(r.humidity_percent),
        airQualityIndex: Number(r.air_quality_index),
        entryCount: Number(r.entry_count),
        exitCount: Number(r.exit_count),
      })),
      (chunk) => tx.occupancy.createMany({ data: chunk }),
    );

    await chunkedCreateMany(
      "alerts_events",
      alertsRows.map((r) => ({
        alertId: r.alert_id,
        timestamp: toUtcDate(r.timestamp),
        buildingId: r.building_id,
        floor: Number(r.floor),
        zone: r.zone,
        severity: r.severity,
        category: r.category,
        deviceId: r.device_id,
        alarmType: r.alarm_type,
        description: r.description,
        value: Number(r.value),
        threshold: Number(r.threshold),
        unit: r.unit,
        durationMinutes: Number(r.duration_minutes),
        resolvedAt: toNullableUtcDate(r.resolved_at),
        status: r.status,
        acknowledgedBy: r.acknowledged_by,
      })),
      (chunk) => tx.alertsEvents.createMany({ data: chunk }),
    );
  });

  console.log("Verifying row counts...");
  const [energyCount, hvacCount, occupancyCount, alertsCount] =
    await Promise.all([
      prisma.energyConsumption.count(),
      prisma.hvacPerformance.count(),
      prisma.occupancy.count(),
      prisma.alertsEvents.count(),
    ]);

  const actual = {
    energyConsumption: energyCount,
    hvacPerformance: hvacCount,
    occupancy: occupancyCount,
    alertsEvents: alertsCount,
  };

  const mismatches = (
    Object.keys(EXPECTED_COUNTS) as (keyof typeof EXPECTED_COUNTS)[]
  ).filter((key) => actual[key] !== EXPECTED_COUNTS[key]);

  if (mismatches.length > 0) {
    const details = mismatches
      .map((key) => `${key}: expected ${EXPECTED_COUNTS[key]}, got ${actual[key]}`)
      .join("; ");
    throw new Error(`Seed row count mismatch — ${details}`);
  }

  console.log(
    `Seed complete: energy=${actual.energyConsumption} hvac=${actual.hvacPerformance} occupancy=${actual.occupancy} alerts=${actual.alertsEvents}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
