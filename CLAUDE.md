# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A take-home technical test: a BMS (building management system) dashboard
builder. Users drag KPI/Bar/Line/Gauge cards onto a grid, configure each
card's data source and axes against real building-sensor CSV data (energy,
HVAC, occupancy, alerts), and view a building floor plan colored by live
occupancy. Full build plan, phase-by-phase, in `bms-technical-test-plan.md`
— read it before making an architectural decision not already reflected
here, since most trade-offs (MSSQL over Postgres, Effect v4 beta, raw-CSV
data facts overriding the dictionary, etc.) were deliberate and are
reasoned through there.

**Status**: required scope (plan phases P0–P7, through the "GATE") is
complete — monorepo, data layer, contract + Effect services, dashboard
builder UI, global filters, floor plan, PIN auth, and polish are all
built and browser-verified. A bonus P8 pass implemented the approved
Claude Design mock ("VS BMS Dashboard.dc.html", project "Dashboard design
with themes" on claude.ai/design) pixel-close on top of the existing
architecture — see PROMPT_HISTORY.md's P8 entry for what was adopted vs.
deliberately not (the mock is a *spec*; its throwaway prototype code was
never imported). A follow-up bonus pass completed the PDF's remaining
optional items: print/PDF export (dashboard header Print button —
light-theme flip, `--print-zoom` fit-to-page, `print:hidden` chrome),
card-removal exit animation (`card-out`, completing add/remove/rearrange
transitions), SQL query logging (`QUERY_LOG=1` → Prisma query events with
duration, wired in `createPrismaClient`), and a `bun test` unit suite
(see Commands). Track B (CI/deploy) remains out of scope. Update this
file's "Architecture" section if that changes — it should always describe
what's actually in the tree, not just what's planned.

## Dev environment (Nix-only for tooling; MSSQL via Docker)

```bash
direnv allow                    # or: nix develop
docker compose up -d            # MSSQL 2022, healthcheck-gated
bun install
bun run db:migrate              # prisma migrate deploy, packages/database/prisma/schema.prisma
bun run db:seed                 # papaparse over data/*.csv, asserts exact row counts 80/35/63/20
bun run dev                     # turbo run dev — starts apps/web on :3000
```

Stop MSSQL: `docker compose down` (add `-v` to also drop the data volume —
that wipes seeded data, `bun run db:migrate && bun run db:seed` rebuilds
it from the committed CSVs in seconds, so it's a safe reset).

MSSQL is Docker-only: the server itself isn't packaged in nixpkgs at all
(open request, nixpkgs#325922) — the comparison researched in
`bms-technical-test-plan.md` §12.1 is moot, Docker is the only local-server
path. `devshell.nix` provides only the *client-side* tooling: bun/node,
`sqlcmd`, `openssl` (for generating `AUTH_SECRET`), and nixpkgs
`prisma-engines_7` (just `schema-engine`, exported as
`PRISMA_SCHEMA_ENGINE_BINARY`) — Prisma's npm-downloaded engine binaries
are dynamically linked and don't run on NixOS/nix-darwin without this. The
Prisma 7 `prisma-client` generator + `@prisma/adapter-mssql` driver
adapter means no Rust *query* engine is needed at runtime, only the schema
engine for the CLI's migrate path.

Default local connection string (matches `docker-compose.yml`):
`sqlserver://localhost:1433;database=bms;user=sa;password=BmsDashboard!2025;trustServerCertificate=true`.
Create the `bms` database once after first `docker compose up` (migrate
does not create the database itself):
`sqlcmd -S localhost -U sa -P "BmsDashboard!2025" -C -Q "CREATE DATABASE bms;"`.

## Commands

Root-level (turbo-orchestrated across the workspace):
- `bun run dev` / `bun run build` / `bun run lint` / `bun run test` /
  `bun run typecheck`
- `bun run db:migrate` / `bun run db:seed` / `bun run db:generate`
  (aliases into `packages/database`)

`apps/web`: standard Next.js scripts (`dev`, `build`, `start`, `lint`,
`typecheck`) plus `test` (`bun test src` — DB-free unit tests colocated
as `src/server/*.test.ts`: QueryService validation/aggregation-mapping/
where-building against a recorded Prisma stub, session-token
sign/verify/tamper/expiry, and the `TABLE_META ⊆ DB_COLUMN` raw-SQL
whitelist invariant).

## Architecture

**Monorepo**: bun workspaces + turborepo, no build step for internal
packages — `apps/web` imports `@bms/contract` and `@bms/database` as
`workspace:*`, TS source exported directly via each package's `exports`
map (`effect` is a peer dependency of `@bms/contract`, pinned exact,
matching `apps/web`'s own `effect` dependency — see the Effect v4 note
below).

**`packages/database`** (`@bms/database`): Prisma 7 + MSSQL via
`@prisma/adapter-mssql`, `prisma-client` generator with a custom output
directory (`src/generated/`), **committed** (per the take-home's
deliverable list — do not gitignore it). `schema.prisma` has five models
— `EnergyConsumption`, `HvacPerformance`, `Occupancy`, `AlertsEvents`,
plus whatever `packages/database/prisma/schema.prisma` currently defines
— derived from the actual CSVs in `data/`, not blindly from
`data/DATA_DICTIONARY.md` (the two disagree in a couple of places, e.g.
`category: Lighting` appears in the data but not the dictionary — model
categorical columns as plain `String`, never a DB enum, and source filter
dropdowns from live `distinct` queries). `resolvedAt` is the only nullable
column in the schema. `src/seed.ts` parses the CSVs with `papaparse` and
asserts exact row counts (80/35/63/20) before considering the seed
successful — that assertion is the evidence the CSV import is correct,
don't relax it.

**`packages/contract`** (`@bms/contract`): the single source of truth for
every shape both `apps/web`'s frontend and backend agree on — Effect
Schema domain models (`DataSource`, `Aggregation`, `CardType`,
`TABLE_META`), request/response schemas (`CardConfig` discriminated
union, `GlobalFilters`, `QueryRequest`/`QueryResponse`,
`OccupancyLatestResponse`, `DashboardState`, `LoginRequest`), and tagged
errors (`ValidationError`, `UnknownColumnError`, `UnauthorizedError`,
`DbError`). `TABLE_META` is simultaneously the `/api/meta` response *and*
the server-side column whitelist `QueryService` validates against —
one definition, two jobs, so the two can't drift.

**`apps/web`**: Next.js App Router, frontend *and* backend in one app —
route handlers under `src/app/api/` are thin adapters (parse → decode →
run Effect → map tagged errors to HTTP status), all real logic lives in
`src/server/` as Effect services (`PrismaService`, `QueryService`,
`MetaService`, `OccupancyService`, `AuthService`), composed via
`ManagedRuntime` memoized on `globalThis` (avoids leaking connection
pools across Next dev hot-reloads). `QueryService.execute` has two
execution paths: Prisma `groupBy`/`aggregate` for everything except
line-chart hourly bucketing, which needs `$queryRaw` with SQL Server
2022's `DATETRUNC` — identifiers there are resolved through a literal
lookup map keyed by an already-whitelisted column name (never
string-interpolated from request input), values go through `Prisma.sql`
parameters.

**Effect version: v4 beta** (`4.0.0-beta.98` at time of writing, pinned
exact — no caret, since betas can break between releases). Exposure is
deliberately narrow: core `effect` only (Schema, Context, Layer, Effect),
no platform/http/cluster packages, which is the subset whose programming
model hasn't changed from v3. If the beta blocks progress, the fallback
is a mechanical rename to v3 idioms (`Effect.Service`/`Context.Tag`,
`Data.TaggedError` instead of `Context.Service`/`Schema.TaggedErrorClass`)
— note it here and in `PROMPT_HISTORY.md` if that fallback is taken.

**Auth** (`src/proxy.ts`, `src/server/auth.ts`, `src/server/session-token.ts`):
added beyond the take-home's spec to demonstrate session handling — a
single shared PIN (`APP_PIN`), constant-time-compared, signing a
`base64url(payload).base64url(hmacSha256(payload))` cookie (no JWT
library) with `AUTH_SECRET`. `APP_PIN` is a free-length string, not a
4-digit code — dev default `1234`, real values via `openssl rand -hex 16`
(32 chars) — so the login form is a typed password input (the dev-PIN
hint and one-click demo button are development-build-only); don't
reintroduce a fixed-length numeric keypad there. `session-token.ts` holds the pure sign/verify
functions with no Effect dependency, shared between the Effect-wrapped
`AuthService` (used by the login/logout routes) and the plain-function
guard in `proxy.ts`, which stays dependency-free by design — Proxy runs
on every request including prefetches, so it does a cheap
cookie-signature check only, never touching Prisma/ManagedRuntime.

**Frontend** (`src/components/`, `src/stores/`, `src/hooks/`): three
separate state stores by lifetime — `stores/dashboard-store.ts` (Zustand
+ `persist`, card list + react-grid-layout positions), `stores/filter-store.ts`
(Zustand, no persist — global filters reset on refresh, deliberately),
and TanStack Query for all server data. `useCardQuery`'s query key
(`[cardId, config, filters]`) is what makes "change a global filter,
every card refetches" work — no manual event bus. `react-grid-layout` v2
(a from-scratch TS rewrite, materially different API from v1) drives the
dashboard canvas; new externally-added cards run through RGL's own
`verticalCompactor.compact()` before being stored, since v2 doesn't
auto-compact positions supplied from outside its own drag/resize reducer.
A second RGL v2 quirk: right after an external drop, its publish effect
can fire `onLayoutChange` with a stale (pre-drop) layout that's missing
the card `addCard` just placed — the store's `setLayout` therefore
rejects any published layout missing a live card's slot and no-ops on
non-changes (see the comment on `setLayout`); storing such an echo
verbatim re-enters RGL's adopt/publish effect cycle until React's
"Maximum update depth exceeded" guard trips.
The floor plan (`components/floor-plan/`) draws only the zones each
floor's real occupancy data has (`zone-shapes.ts`'s verified matrix —
`BLD-001` floor 2 is the only 3-zone floor), never a fabricated zone;
its geometry (building shell, decorative CORE/RECEPTION/LOBBY strips)
is traced from the design mock.

**Theme/design layer** (bonus P8): the UI implements the approved Claude
Design mock pixel-close. `globals.css` carries the mock's oklch token
sets mapped onto shadcn semantics (design `bg/surface-1/surface-2/
primary-soft/crit` → `background/card/secondary/accent/destructive`)
plus design-only tokens (`--surface-3`, `--fg-subtle`, `--occ-*`
occupancy ramp, `--c1..--c5` monochrome chart series ramp, `--grid`);
dark is the default theme via `next-themes`, toggled from the sidebar.
Fonts are Hanken Grotesk + IBM Plex Mono via `next/font`. Icons are the
mock's own SVGs re-authored in `components/icons.tsx` — don't swap in
lucide equivalents on design surfaces. Chart/status/occupancy colors are
CSS vars only (never hexes) so both themes work; red stays reserved for
Critical/high-occupancy. One deliberate exception to mock-fidelity: the
floor-plan occupancy ramp is green/yellow/red per the take-home PDF's
required mapping (with paired `--occ-*-ink` tokens for labels drawn on
the fills — yellow needs dark ink), overriding the mock's
neutral/green/red legend; don't re-sync those tokens from the mock.
Design-driven *features* that are real, not
cosmetic: dashboard export/import as JSON (decoded against the contract's
`DashboardState` with `Schema.decodeUnknownSync` — this v4 beta has no
`decodeUnknownEither`), sample-dashboard loader (`lib/sample-dashboard.ts`,
real TABLE_META configs), card duplication, KPI sparkline+delta (a second,
line-shaped query through the same validated `/api/query` path — see
`hooks/use-kpi-spark.ts`), and query stats (`meta.rowCount`/`executedInMs`)
in card footers. The grid is 12 cols × 198px rows (the mock's 4-col
lattice ×3); `dashboard-store.ts` persists at `version: 1` with a
migration rescaling pre-redesign 30px-row layouts. The mock's "Simulate
stale" button and per-column distinct filter dropdowns were deliberately
NOT implemented (client-side fake staleness would counterfeit server
truth — `DEMO_NOW` covers that demo; no distinct-values endpoint exists).

**Known limitation, not a bug**: the seed CSVs cover a single day
(2025-06-01, hourly, last reading 22:00/22:30). "Today"/"last 7 days"
filters are empty against real wall-clock time unless `DEMO_NOW` is set —
that's intentional (an honest empty state is itself a required feature,
not a bug to hide). See `README.md`'s demo section for the specific
`DEMO_NOW` values that populate vs. deliberately stale the dashboard.

## Other agent-facing notes

`apps/web/CLAUDE.md` (imports `apps/web/AGENTS.md`) warns that this
project's Next.js version (16.2.10) has breaking changes vs. training-data
Next.js — read `apps/web/node_modules/next/dist/docs/` before writing App
Router / route handler code there. One breaking change already found and
adapted to: **`middleware.ts` is renamed `proxy.ts` in Next 16** (`export
function middleware` → `export function proxy`), and Proxy now defaults
to the Node.js runtime instead of Edge — this repo's session guard is at
`src/proxy.ts`, not `src/middleware.ts`.

## No co-author

Never write commit message with co-author
