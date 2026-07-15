import { SqlClient } from "@effect/sql";
import { Effect } from "effect";
import { DbLive } from "./db";
import { refreshHourlyRollup } from "./rollup";

/**
 * Small, demonstrative seed — a few floors, a few days, 5-minute samples.
 * NOT an attempt to simulate real skyscraper scale (thousands of points,
 * years of history, billions of rows); the schema/queries are designed for
 * that scale, but loading it here would just be a slow no-op for an
 * interview scaffold.
 */

const FLOORS = [1, 5, 10, 15, 20];
const SAMPLE_INTERVAL_MINUTES = 5;
const DAYS_OF_HISTORY = 3;

type Device = {
  device_id: string;
  floor: number;
  metric_type: "ac_temp_c" | "electrical_load_kw";
  label: string;
};

const devices: Device[] = FLOORS.flatMap((floor) => [
  {
    device_id: `floor-${floor}-ac`,
    floor,
    metric_type: "ac_temp_c" as const,
    label: `Floor ${floor} AC Supply Temp`,
  },
  {
    device_id: `floor-${floor}-elec`,
    floor,
    metric_type: "electrical_load_kw" as const,
    label: `Floor ${floor} Electrical Load`,
  },
]);

const baseline = (metric: Device["metric_type"]) =>
  metric === "ac_temp_c" ? 18 : 40;

const noise = (metric: Device["metric_type"]) =>
  metric === "ac_temp_c" ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 8;

// Office hours load/cooling curve: higher during 9am-6pm.
const diurnalFactor = (hour: number) => (hour >= 9 && hour <= 18 ? 1.3 : 0.8);

const program = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* Effect.log(`seeding ${devices.length} devices`);
  yield* sql`
    INSERT INTO devices ${sql.insert(devices)}
    ON CONFLICT (device_id) DO NOTHING
  `;

  const now = new Date();
  const start = new Date(now.getTime() - DAYS_OF_HISTORY * 24 * 60 * 60 * 1000);
  const totalSamples = (DAYS_OF_HISTORY * 24 * 60) / SAMPLE_INTERVAL_MINUTES;

  // Inject one obvious anomaly: a chiller fault spike on floor 10 AC,
  // ~12 hours ago, so the anomaly-flagging endpoint has something to find.
  const anomalyAt = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const BATCH = 2000;
  let batch: { device_id: string; metric_type: string; recorded_at: Date; value: number }[] = [];

  const flush = () =>
    Effect.gen(function* () {
      if (batch.length === 0) return;
      yield* sql`INSERT INTO readings ${sql.insert(batch)}`;
      batch = [];
    });

  for (let i = 0; i < totalSamples; i++) {
    const t = new Date(start.getTime() + i * SAMPLE_INTERVAL_MINUTES * 60 * 1000);
    const hour = t.getHours();

    for (const device of devices) {
      let value = baseline(device.metric_type) * diurnalFactor(hour) + noise(device.metric_type);

      const isAnomalyWindow =
        device.device_id === "floor-10-ac" &&
        Math.abs(t.getTime() - anomalyAt.getTime()) < 45 * 60 * 1000;
      if (isAnomalyWindow) {
        value += 9; // chiller fault: supply temp spikes ~9C above normal
      }

      batch.push({
        device_id: device.device_id,
        metric_type: device.metric_type,
        recorded_at: t,
        value: Math.round(value * 100) / 100,
      });
    }

    if (batch.length >= BATCH) {
      yield* flush();
    }
  }
  yield* flush();

  yield* Effect.log("readings inserted, refreshing hourly rollup");
  yield* refreshHourlyRollup(start);

  yield* Effect.log("seed complete");
});

Effect.runPromise(program.pipe(Effect.provide(DbLive))).catch((error) => {
  console.error(error);
  process.exit(1);
});
