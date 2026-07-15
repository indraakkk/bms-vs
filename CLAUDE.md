# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A turborepo scaffold (Next.js + Effect-ts + Postgres/TimescaleDB) modeling
building sensor data (HVAC, electrical) for a CBD-skyscraper-scale smart
buildings use case. See `README.md` for the full rationale behind each
architecture decision below — read it before changing schema, caching, or
infra choices, since several of them were deliberate trade-offs, not
defaults.

## Dev environment (Nix-only, no host installs)

`direnv allow` (or `nix develop`) builds and boots a **project-local**
Postgres 16 with TimescaleDB compiled in and preloaded, backed by
`.pgdata/` inside this repo (gitignored, not committed). This is **not**
the machine-wide shared home-manager Postgres server other projects on
this machine use — it's fully isolated to this project (own data dir, own
port `5544`).

**Always run `nix develop` from the repo root.** `devshell.nix` resolves
`PGDATA`/`PGHOST` from `$PWD` at shell-entry — invoking it from a
subdirectory (e.g. `cd apps/web && nix develop ../..`) boots a second,
broken Postgres instance there instead of reusing the root one. If you
need to run a command from a subdirectory, `cd` inside the wrapped shell
command, not before invoking `nix develop`.

```bash
direnv allow          # or: nix develop
bun install
bun run db:migrate    # applies packages/data/src/migrations/*.sql
bun run db:seed       # small demonstrative dataset, see packages/data/src/seed.ts
bun run dev           # turbo run dev — starts apps/web on :3000
```

Stop the Postgres server: `pg_ctl -D "$PGDATA" stop`.

TimescaleDB is TSL-licensed ("unfree" to nixpkgs); `flake.nix` scopes
`allowUnfreePredicate` to just `timescaledb`, not global nix config.

### Resetting the database

`TRUNCATE ... CASCADE` does **not** properly invalidate a continuous
aggregate (TRUNCATE bypasses the row-level triggers Timescale's
invalidation log relies on) — it will leave stale materialized rows in
`readings_hourly_rollup`. For a truly clean reset, drop and recreate the
database instead:

```bash
dropdb --if-exists venturesea && createdb venturesea
psql -d venturesea -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
bun run db:migrate && bun run db:seed
```

## Commands

Root-level (turbo-orchestrated across the workspace):
- `bun run dev` / `bun run build` / `bun run lint` / `bun run typecheck`

`packages/data` (run via `bun run --cwd packages/data <script>`, or the
root `db:migrate` / `db:seed` aliases):
- `migrate` — runs `src/migrations/run.ts`, applies `*.sql` files in
  `src/migrations/` in filename order, tracked in a `schema_migrations`
  table (idempotent — reruns skip already-applied files by filename, so
  editing an already-applied migration's contents has no effect until the
  db is reset)
- `seed` — runs `src/seed.ts`
- `typecheck` — `tsc --noEmit`

`apps/web`: standard Next.js scripts (`dev`, `build`, `start`, `lint`).
There is no test runner configured in this repo yet.

## Architecture

**Monorepo**: bun workspaces + turborepo. `apps/web` (Next.js App Router)
depends on `packages/data` (`@venturesea/data`) via `workspace:*`. Internal
imports in `packages/data/src` must be **extensionless** (`from "./db"`,
not `from "./db.js"`) — despite being the correct Node-ESM convention,
`.js`-suffixed imports pointing at `.ts` source aren't resolved by
Turbopack when bundling the workspace package into `apps/web`, even though
`bun run` resolves them fine standalone.

**Data layer** (`packages/data/src`): all DB access goes through
`@effect/sql-pg` (tagged-template SQL, not an ORM or raw `pg`). Every
exported function returns an `Effect` requiring `SqlClient.SqlClient`;
callers provide `DbLive` (`db.ts`) via `Effect.provide`. Key modules:
- `db.ts` — `PgClient` layer, reads `DATABASE_URL` from env
- `devices.ts` — device listing
- `analytics.ts` — `getRollupSeries` (reads only from the continuous
  aggregate, never raw `readings`) + `detectAnomalies` (naive rolling
  z-score, see caveat below)
- `rollup.ts` — `refreshHourlyRollup(since)`, forces immediate
  materialization of the continuous aggregate after a bulk seed (the
  scheduled policy alone could take up to an hour to catch up)
- `migrations/` — plain numbered `.sql` files + a small runner, no
  migration framework

**Schema** (`packages/data/src/migrations/0001_init.sql`,
`0002_rollup_policy.sql`): `readings` is a **real TimescaleDB hypertable**
(`create_hypertable`, 1-day chunks), and `readings_hourly_rollup` is a
**real continuous aggregate** with a scheduled refresh policy — not
hand-rolled substitutes. The API/dashboard read path always goes through
the rollup, never raw `readings`; raw readings are only for drilling into
a single flagged hour. This is also why there's no Redis in the stack —
the continuous aggregate is the cache.

**API routes** (`apps/web/src/app/api/`): `/api/devices` and
`/api/devices/[deviceId]/readings` (time-range + rollup query + anomaly
flags), thin wrappers that call into `@venturesea/data` and run the
`Effect` with `Effect.runPromise`.

**Known limitation, not a bug**: `detectAnomalies`'s rolling z-score has
no seasonality awareness. With a short trailing window it can produce
very large/noisy z-scores (near-zero baseline variance); with a longer
window spanning a full day/night cycle, the normal diurnal swing can
itself inflate the baseline variance and partly mask a real anomaly. This
is intentional/documented, not something to silently "fix" by tuning
thresholds — see `README.md` for the reasoning.

## Other agent-facing notes

`apps/web/CLAUDE.md` (imports `apps/web/AGENTS.md`) warns that this
project's Next.js version (16.2.10) has breaking changes vs. training-data
Next.js — read `apps/web/node_modules/next/dist/docs/` before writing App
Router / route handler code there.
