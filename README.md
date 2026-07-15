# venturesea

Turborepo scaffold: Next.js (App Router) + Effect-ts + Postgres/TimescaleDB,
modeling building sensor data (HVAC, electrical) for a CBD-skyscraper-scale
smart buildings use case.

## Dev environment

Nix-only, no host installs. `direnv allow` (or `nix develop`) builds and
boots a **project-local** Postgres 16 with TimescaleDB compiled in and
preloaded, backed by `.pgdata/` inside this repo (gitignored). It is not
the machine-wide shared home-manager Postgres server other projects use.

```
direnv allow
bun install
bun run db:migrate
bun run db:seed
bun run dev
```

To stop the server: `pg_ctl -D "$PGDATA" stop`. Always run `nix develop`
from the repo root — the data/socket dirs are resolved from `$PWD` at
shell-entry, so invoking it from a subdirectory boots a second, wrong
instance.

## Layout

- `apps/web` — Next.js app, dashboard + API routes
- `packages/data` — Effect-ts data layer (`@effect/sql-pg`), schema,
  migrations, seed, rollup + anomaly-detection logic

## Architecture decisions (and why)

**Project-scoped Postgres + TimescaleDB, not the shared dev server.**
nixpkgs *has* `postgresql16Packages.timescaledb`, but the machine's shared
home-manager Postgres server (used by every other project) runs a plain
`postgresql_16` with nothing preloaded — `pg_available_extensions` confirms
it. Loading TimescaleDB there would mean rebuilding that shared package,
changing `shared_preload_libraries`, and restarting a server other projects
depend on. Instead, `flake.nix` builds `postgresql_16.withPackages (p: [
p.timescaledb ])` and `devshell.nix` runs it as its own instance (own
data dir, own port `5544`), so only this project is affected. TimescaleDB
is TSL-licensed ("unfree" to nixpkgs); the `allowUnfreePredicate` in
`flake.nix` is scoped to just this project's `nixpkgs` import, not the
user's global config.

**`readings` is a real hypertable, `readings_hourly_rollup` is a real
continuous aggregate** (see `packages/data/src/migrations/0001_init.sql`,
`0002_rollup_policy.sql`) — not a hand-rolled substitute. `create_hypertable`
chunks by 1-day intervals; the continuous aggregate has a scheduled refresh
policy, and `refreshHourlyRollup()` (`packages/data/src/rollup.ts`) forces
an immediate materialization after a bulk seed so the API isn't waiting on
the next scheduled run.

**No Redis.** The continuous aggregate *is* the cache — reads never hit raw
`readings`. If in-process caching is ever needed on top, Effect's `Cache`
covers it with no added infra.

**`@effect/sql-pg` over raw `pg`.** Tagged-template SQL (keeps queries
readable/inspectable) plus Effect's resource management and retries, and a
natural fit for `Stream`-based ingest pipelines later.

**Seed data is intentionally small** (5 floors × 2 metrics × 3 days ×
5-minute samples ≈ 8.6k rows) — a demonstrated pattern for the schema and
queries, not an attempt to simulate real skyscraper scale (thousands of
points, years of history, billions of rows).

**Anomaly detection is a naive rolling z-score** over the hourly rollup, not
seasonality-aware — worth noting out loud: with a short trailing window
(start of the series) the near-zero baseline variance inflates z-scores;
with a longer window spanning a full day/night cycle, that same natural
diurnal swing can partly mask a real nighttime spike. A production version
would decompose the daily/weekly seasonal pattern first (or use XGBoost
load forecasts, per the smart buildings practice) before flagging
deviations.
