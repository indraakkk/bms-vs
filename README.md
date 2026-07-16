# BMS Dashboard

A building-management-system dashboard builder: drag KPI/Bar/Line/Gauge
cards onto a grid, configure each card's data source and axes against
real building-sensor data (energy, HVAC, occupancy, alerts), filter every
card at once by building/floor/time-range, and view a building floor plan
colored live by occupancy.

Built against `bms-technical-test-plan.md` (the full build plan, phase by
phase) and `data/DATA_DICTIONARY.md` / `data/*.csv` (the source data —
profiled directly, not just read from the dictionary; see
`ARCHITECTURE.md`'s schema section for where the two disagree).

The UI implements an approved Claude Design mock ("VS BMS Dashboard",
bonus pass): dark-first theme with a Light/Dark toggle in the sidebar,
PIN login, and a sidebar console layout across the dashboard builder
and floor plan. Functional extras that came with the design: export/import
the dashboard as JSON (validated against the shared contract schema), a
one-click sample dashboard, card duplication, KPI trend sparklines, and
per-card query stats (row count · execution ms) in each card's footer.

## Quick start

Requires [Docker](https://www.docker.com/) and either [Nix](https://nixos.org/)
(recommended — pins every tool version) or a local Bun install.

```bash
# 1. Start MSSQL (first run pulls a ~1.5GB image)
docker compose up -d

# 2. Enter the dev shell (Nix) — provides bun, sqlcmd, openssl, and the
#    Prisma NixOS fix. Skip this if you already have bun installed.
direnv allow          # or: nix develop

# 3. Create the database (one-time — migrate does not create it)
sqlcmd -S localhost -U sa -P "BmsDashboard!2025" -C -Q "CREATE DATABASE bms;"

# 4. Install deps, apply the schema, seed from the committed CSVs
bun install
bun run db:migrate
bun run db:seed        # asserts exact row counts 80/35/63/20, fails loudly otherwise

# 5. Configure environment (see below), then run
bun run dev             # http://localhost:3000
```

Reset the database at any point: `docker compose down -v` (drops the data
volume) then repeat steps 3–4 — safe and fast, since everything is
rebuilt from the committed CSVs.

## Environment variables

Copy `.env.example` to `apps/web/.env` **and** `packages/database/.env`
(both gitignored):

| Variable | Purpose | Default (docker-compose.yml) |
|---|---|---|
| `DATABASE_URL` | MSSQL connection string | `sqlserver://localhost:1433;database=bms;user=sa;password=BmsDashboard!2025;trustServerCertificate=true` |
| `APP_PIN` | PIN for the login screen — free-length; generate a real one with `openssl rand -hex 16` (see [Auth](#auth), below) | `1234` (dev) |
| `AUTH_SECRET` | HMAC key signing the session cookie — generate with `openssl rand -base64 32` | — |
| `DEMO_NOW` | Pins "now" for time-range presets and occupancy staleness (see [Demo data](#demo-data--demo_now), below) | unset (real time) |

## Auth

A PIN-gated login was **added beyond the take-home's spec** to demonstrate
session handling — it is a demo scheme (one shared PIN, HMAC-signed
cookie, no user accounts), not production auth. The PIN is a typed,
free-length secret (`APP_PIN` above), not a 4-digit code: set it to
anything, e.g. a 32-char `openssl rand -hex 16` value — the server
compares constant-time and doesn't leak length. The dev default is `1234`,
and the login page's PIN hint + one-click demo button render **only in
development builds**. Everything except `/login` and `/api/auth/*`
requires a valid session; sessions last 24h.

## Demo data & `DEMO_NOW`

The seed data covers exactly one day — **2025-06-01**, hourly, last
reading at 22:00 (22:30 for alerts). Real "today" / "last 7 days" filters
and the floor plan's occupancy staleness check are computed against the
actual wall clock, so without `DEMO_NOW` set they honestly show empty /
stale states against that 2025-06-01 data — **this is a required feature
demonstrating edge-case handling, not a bug**. Set `DEMO_NOW` in
`apps/web/.env` to demo the populated state instead:

- `DEMO_NOW=2025-06-01T22:30:00Z` — every zone fresh, "today" covers the
  full seed dataset, KPI/gauge/bar/line cards all render live-looking
  data. Best default for a walkthrough.
- `DEMO_NOW=2025-06-01T23:30:00Z` — every occupancy zone reads as stale
  (>1h since 22:00) — demonstrates the floor plan's gray "No data" state
  on demand.
- Unset — real time, honest empty states everywhere (what a fresh clone
  gets by default; also what production would see day-to-day if this
  were real building data).

Restart `bun run dev` after changing `DEMO_NOW` (env vars aren't hot-reloaded).

## Commands

Root (turbo-orchestrated):

```bash
bun run dev          # start apps/web on :3000
bun run build        # production build
bun run lint          # eslint across the workspace
bun run typecheck    # tsc --noEmit across the workspace
bun run db:migrate   # prisma migrate deploy
bun run db:seed      # parse data/*.csv, assert exact row counts
bun run db:generate  # regenerate the Prisma client
```

## Layout

```
apps/web/               Next.js App Router — frontend AND backend
  src/app/(app)/         dashboard + floor-plan pages (session-guarded)
  src/app/login/          PIN login page
  src/app/api/            route handlers (thin — parse → decode → run Effect → map errors)
  src/server/             Effect services: Prisma, Query, Meta, Occupancy, Auth, Clock
  src/components/         dashboard canvas/cards, floor plan, auth, ui/ (shadcn)
  src/proxy.ts            session guard (Next.js 16's renamed middleware.ts)
packages/contract/       @bms/contract — Effect Schema single source of truth
packages/database/       @bms/database — Prisma schema, generated client (committed), seed
data/                     the 4 source CSVs + DATA_DICTIONARY.md, committed verbatim
docker-compose.yml        MSSQL 2022
```

See `ARCHITECTURE.md` for the design rationale (state management, the
SQL Server→card data flow, drag/drop strategy, dynamic axis binding,
schema decisions, SVG floor-plan approach) and `PROMPT_HISTORY.md` for
the phase-by-phase build log and decision record.

## Known limitations (by design, not oversights)

- **No test suite** in this pass — unit tests for `QueryService`
  (validation + aggregation mapping) and the occupancy color/staleness
  helpers are natural additions but weren't in the required scope for
  this pass.
- **Single shared PIN**, not per-user accounts — see [Auth](#auth).
- **No CI/deploy pipeline** — this pass covers the local dev environment
  (Nix devshell + Docker Compose) only.
