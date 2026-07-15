import { SqlClient } from "@effect/sql";
import { Effect } from "effect";

export type RollupPoint = {
  bucket_start: Date;
  avg_value: number;
  min_value: number;
  max_value: number;
  stddev_value: number | null;
  sample_count: number;
};

export type AnomalyPoint = RollupPoint & {
  is_anomaly: boolean;
  z_score: number | null;
};

/**
 * Reads pre-aggregated hourly rollups for a device over [from, to) — never
 * scans raw `readings` for a chart. At skyscraper scale, raw readings are
 * for drill-down on a single flagged hour, not for populating a chart.
 */
export const getRollupSeries = (deviceId: string, from: Date, to: Date) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<RollupPoint>`
      SELECT bucket_start, avg_value, min_value, max_value, stddev_value, sample_count
      FROM readings_hourly_rollup
      WHERE device_id = ${deviceId}
        AND bucket_start >= ${from}
        AND bucket_start < ${to}
      ORDER BY bucket_start ASC
    `;
  });

/**
 * Flags hours whose avg_value deviates more than `threshold` standard
 * deviations from the trailing `windowSize`-bucket mean. A naive
 * rolling z-score — enough to demo the pattern, not a production
 * anomaly detector (no seasonality, no XGBoost).
 */
export const detectAnomalies = (
  points: readonly RollupPoint[],
  windowSize = 24,
  threshold = 2.5,
): AnomalyPoint[] => {
  return points.map((point, i) => {
    const windowStart = Math.max(0, i - windowSize);
    const window = points.slice(windowStart, i);
    if (window.length < 3) {
      return { ...point, is_anomaly: false, z_score: null };
    }

    const mean = window.reduce((sum, p) => sum + p.avg_value, 0) / window.length;
    const variance =
      window.reduce((sum, p) => sum + (p.avg_value - mean) ** 2, 0) / window.length;
    const stddev = Math.sqrt(variance);

    if (stddev === 0) {
      return { ...point, is_anomaly: false, z_score: null };
    }

    const zScore = (point.avg_value - mean) / stddev;
    return { ...point, is_anomaly: Math.abs(zScore) > threshold, z_score: zScore };
  });
};
