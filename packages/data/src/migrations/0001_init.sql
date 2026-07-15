CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Devices in the building: HVAC sensors, electrical meters, etc.
CREATE TABLE IF NOT EXISTS devices (
  device_id   TEXT PRIMARY KEY,
  floor       INTEGER NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('ac_temp_c', 'electrical_load_kw')),
  label       TEXT NOT NULL
);

-- Raw sensor readings, as a TimescaleDB hypertable partitioned by time.
--
-- At CBD-skyscraper scale (thousands of points x 1-5 min sampling x years)
-- this table is the thing that breaks a naive design first. A hypertable
-- auto-manages time-range chunking (create_hypertable below) so raw-data
-- queries and retention (drop_chunks instead of DELETE) stay cheap without
-- hand-managing partitions. This is running against this project's own
-- Postgres (see flake.nix / devshell.nix) — not the shared dev server used
-- by other projects, which does not have TimescaleDB loaded. See
-- packages/data/README.md for that decision.
CREATE TABLE IF NOT EXISTS readings (
  device_id   TEXT NOT NULL REFERENCES devices (device_id),
  metric_type TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  value       DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (device_id, recorded_at)
);

-- 1-day chunks: at thousands of points x 1-5 min sampling, a day of raw
-- readings is a few hundred MB — small enough to keep chunk indexes
-- in memory, and old chunks can be dropped/compressed independently.
SELECT create_hypertable('readings', by_range('recorded_at', INTERVAL '1 day'), if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS readings_device_time_idx
  ON readings (device_id, recorded_at DESC);

-- Hourly rollup as a continuous aggregate — Timescale keeps this
-- incrementally up to date (see add_continuous_aggregate_policy in
-- 0002_rollup_policy.sql) instead of the app hand-rolling refresh SQL.
-- This view *is* the read path for the dashboard/API; raw `readings` is
-- only for drill-down into a single flagged hour. It's also why the
-- scaffold doesn't reach for Redis — this materialized view is the cache.
CREATE MATERIALIZED VIEW IF NOT EXISTS readings_hourly_rollup
WITH (timescaledb.continuous) AS
SELECT
  device_id,
  metric_type,
  time_bucket('1 hour', recorded_at) AS bucket_start,
  count(*)          AS sample_count,
  avg(value)        AS avg_value,
  min(value)        AS min_value,
  max(value)        AS max_value,
  stddev_samp(value) AS stddev_value
FROM readings
GROUP BY device_id, metric_type, time_bucket('1 hour', recorded_at)
WITH NO DATA;
