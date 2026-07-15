-- Keeps readings_hourly_rollup incrementally up to date without the app
-- hand-rolling a refresh job. In production this is enough on its own;
-- for the seed script (packages/data/src/seed.ts) we still call
-- refresh_continuous_aggregate() once immediately after loading data,
-- since this policy's first scheduled run could be up to an hour away.
SELECT add_continuous_aggregate_policy('readings_hourly_rollup',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);
