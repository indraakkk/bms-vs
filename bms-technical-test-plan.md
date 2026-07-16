# BMS Dashboard Builder — Build Plan (v3)

Take-home test, 2-day limit. Every required item first, then bonuses. Sources: TECHNICAL TEST.pdf, the actual 4 CSVs + DATA_DICTIONARY.md (profiled, facts below), template repo `indraakkk/learning-pgtimescaledb`, services-and-layers pattern from effect.solutions, contract package pattern from `typeonce-dev/sync-engine-web`.

---

## 0. Architecture: single Next.js app (settled)

The PDF's Technical Constraints are explicit: "Runtime: Node.js (integrated via Next.js API Routes / Route Handlers)" and "API Design: RESTful endpoints or Next.js Server Actions". So: **one app, `apps/web`. No separate server.**

Separation still happens, at the package level. Route handlers are thin HTTP adapters (~15 lines: parse → decode → run Effect → map errors). All backend logic lives in Effect services. Reviewers see spec compliance and clean frontend/backend separation at the same time. Reuse this paragraph in ARCHITECTURE.md as the "clear frontend/backend separation" answer.

---

## 1. Monorepo layout

Reuse the template's Turborepo + Bun workspaces skeleton. **`flake.nix` + `devshell.nix` is the first-class dev environment** (adapted: drop the Postgres/Timescale service, keep tooling; details in Section 12). MSSQL itself always runs in Docker — the server does not exist in nixpkgs (Section 12 has the research verdict). Once the devshell path works, a full-Docker local environment is added as the reviewer/no-Nix path.

```
bms-dashboard/
├─ apps/
│  └─ web/                      # Next.js 16 App Router — frontend AND backend
│     ├─ src/app/
│     │  ├─ (app)/dashboard/    # builder page
│     │  ├─ (app)/floor-plan/   # floor plan page
│     │  ├─ login/
│     │  └─ api/
│     │     ├─ meta/route.ts
│     │     ├─ query/route.ts
│     │     ├─ occupancy/latest/route.ts   # exact path required by PDF
│     │     └─ auth/{login,logout}/route.ts
│     ├─ src/server/            # Effect services, runtime, http adapter
│     ├─ src/components/        # cards, canvas, palette, modal, floorplan, ui/
│     ├─ src/stores/            # zustand
│     └─ middleware.ts          # auth guard
├─ packages/
│  ├─ contract/                 # @bms/contract — Effect Schema single source of truth
│  └─ database/                 # @bms/database — Prisma schema, generated client, seed, layer
├─ data/                        # the 4 CSVs + DATA_DICTIONARY.md, committed verbatim
├─ docker-compose.yml           # MSSQL 2022
├─ turbo.json
└─ README.md, ARCHITECTURE.md, PROMPT_HISTORY.md
```

Package export style follows sync-engine-web's `@local/schema`: TS source exported directly via `exports` map, `effect` as peer dependency, no build step inside the monorepo.

---

## 2. Verified data facts (profiled from the actual CSVs)

These override the dictionary wherever they differ. Seed verification, TABLE_META, filters, and the floor plan are built from these.

| Fact | Value |
|---|---|
| Row counts (exact) | energy 80, hvac 35, occupancy 63, alerts 20 |
| Timestamp range | 2025-06-01 00:00 → 22:00 (single day, hourly; alerts at odd minutes, last 22:30) |
| Nulls | **only** `alerts.resolved_at` (9 of 20). Everything else fully populated, including `acknowledged_by` and `device_id` |
| `alert_id` | ALT-0001…ALT-0020, unique → natural primary key confirmed |
| Occupancy consistency | `person_count/zone_capacity` matches `occupancy_rate_percent` in all 63 rows |
| Buildings / floors | BLD-001, BLD-002 × floors 1, 2 |

**Occupancy zone matrix (drives the floor plan shapes config):**

| Building / Floor | Zones present |
|---|---|
| BLD-001 F1 | Zone-A, Zone-B |
| BLD-001 F2 | Zone-A, Zone-B, Zone-C |
| BLD-002 F1 | Zone-A, Zone-B |
| BLD-002 F2 | Zone-A, Zone-B |

Zone-C exists **only** on BLD-001 Floor 2. Each floor plan draws exactly the zones present in its occupancy data, so BLD-001 F2 is the only 3-zone layout.

**Distinct categoricals (feed TABLE_META filter options):**
- `device_type`: Elevator, HVAC, Lighting, Server Room, UPS · `source_system`: SCADA, Modbus
- `mode`: Cooling only · `operating_status`: Running, Idle (dictionary lists Fault; none in data)
- `severity`: Critical, Warning, Info · `status`: Active, Open, Resolved · `acknowledged_by`: John, Maria, Ops, Security
- `category`: Energy, Environmental, Equipment, **Fire, Lighting**, Occupancy, Security — note **Lighting is in the data but not in the dictionary**. Rule: model categoricals as `String`, never DB enums; validate against data, not the dictionary. Filter dropdowns get their options from live `distinct` queries, not hardcoded lists.
- `alarm_type`: 19 distinct values → plain String.

---

## 3. packages/database — Prisma + MSSQL

Prisma's current SQL Server path (verify versions at install):
- `datasource db { provider = "sqlserver" }`
- Generator `provider = "prisma-client"`, `output = "./generated"` inside the package. **Commit the generated folder** — deliverable 5 literally says "Include the generated Prisma Client in your source code."
- Driver adapter `@prisma/adapter-mssql` (wraps node-mssql). Fallback if it misbehaves: classic `DATABASE_URL` connection-string mode; decide in P1, log the decision in PROMPT_HISTORY.
- `prisma.config.ts` for CLI config (Bun auto-loads .env; otherwise import dotenv at the top).

### schema.prisma (derived from the actual data)

```prisma
model EnergyConsumption {
  id           Int      @id @default(autoincrement())
  timestamp    DateTime
  buildingId   String   @map("building_id")
  floor        Int
  zone         String
  deviceType   String   @map("device_type")
  deviceId     String   @map("device_id")
  energyKwh    Float    @map("energy_kwh")
  powerKw      Float    @map("power_kw")
  voltageV     Float    @map("voltage_v")
  currentA     Float    @map("current_a")
  powerFactor  Float    @map("power_factor")
  costUsd      Float    @map("cost_usd")
  sourceSystem String   @map("source_system")

  @@index([buildingId, timestamp])
  @@map("energy_consumption")
}

model HvacPerformance {
  id                    Int      @id @default(autoincrement())
  timestamp             DateTime
  buildingId            String   @map("building_id")
  floor                 Int
  zone                  String
  unitId                String   @map("unit_id")
  mode                  String
  setpointTempC         Float    @map("setpoint_temp_c")
  actualTempC           Float    @map("actual_temp_c")
  outdoorTempC          Float    @map("outdoor_temp_c")
  humidityPercent       Float    @map("humidity_percent")
  airflowM3h            Float    @map("airflow_m3h")
  filterStatusPercent   Float    @map("filter_status_percent")
  compressorHours       Float    @map("compressor_hours")
  energyEfficiencyRatio Float    @map("energy_efficiency_ratio")
  operatingStatus       String   @map("operating_status")

  @@index([buildingId, timestamp])
  @@map("hvac_performance")
}

model Occupancy {
  id                   Int      @id @default(autoincrement())
  timestamp            DateTime
  buildingId           String   @map("building_id")
  floor                Int
  zone                 String
  zoneCapacity         Int      @map("zone_capacity")
  personCount          Int      @map("person_count")
  occupancyRatePercent Float    @map("occupancy_rate_percent")
  co2Ppm               Int      @map("co2_ppm")
  temperatureC         Float    @map("temperature_c")
  humidityPercent      Float    @map("humidity_percent")
  airQualityIndex      Int      @map("air_quality_index")
  entryCount           Int      @map("entry_count")
  exitCount            Int      @map("exit_count")

  @@index([buildingId, floor, timestamp])   // serves /api/occupancy/latest
  @@map("occupancy")
}

model AlertsEvents {
  alertId         String    @id @map("alert_id")   // ALT-0001…, verified unique
  timestamp       DateTime
  buildingId      String    @map("building_id")
  floor           Int
  zone            String
  severity        String
  category        String
  deviceId        String    @map("device_id")
  alarmType       String    @map("alarm_type")
  description     String
  value           Float
  threshold       Float
  unit            String
  durationMinutes Int       @map("duration_minutes")
  resolvedAt      DateTime? @map("resolved_at")    // 9 of 20 null in data
  status          String
  acknowledgedBy  String    @map("acknowledged_by")

  @@index([buildingId, timestamp])
  @@map("alerts_events")
}
```

Only nullable column in the whole schema: `resolvedAt`. camelCase fields with `@map` to the CSV snake_case, `@@map` for table names, so the seed can map headers mechanically.

**Migrations.** `prisma migrate dev`, not `db push` — migration history is a production-structure signal and the PDF allows either. SA user means the shadow database creates itself.

**Seed (`prisma db seed` via bun).**
- papaparse over `data/*.csv` (all parsing server-side; "no client-side CSV parsing" is a frontend rule but keep everything here anyway).
- Timestamps have no zone. Parse explicitly as UTC (`s.replace(" ", "T") + "Z"`); empty `resolved_at` → null. State the UTC decision in ARCHITECTURE.md.
- `createMany` in chunks inside a transaction, `deleteMany` first for idempotency (**`skipDuplicates` is unsupported on SQL Server**).
- Import verbatim, then assert exact counts: **80 / 35 / 63 / 20**. Fail loudly on mismatch. Cheap, and it is literal evidence for the "CSV import works correctly" rubric line.

**Time handling (single-day data).** Data covers only 2025-06-01, so "today" and "last 7 days" are empty against real time. Keep CSV fidelity and add a `DEMO_NOW` env var: when set, one `now()` helper (ClockService-style) returns it for the time presets and the staleness check; unset means real time, and old data honestly shows the empty/stale states, which are themselves required features. Concrete demo levers, given latest readings are 22:00:
- `DEMO_NOW=2025-06-01T22:30:00Z` → "today" covers everything, all zones fresh.
- `DEMO_NOW=2025-06-01T23:30:00Z` → every zone stale (>1h) → demonstrates the gray "No data" state on demand.
Document both in the README's demo section.

**docker-compose.yml**: `mcr.microsoft.com/mssql/server:2022-latest` (pin 2022: fully supported, has `DATETRUNC`, and is what Prisma's sqlserver provider is most battle-tested against; SQL Server 2025 is GA with a `2025-latest` tag if wanted later). `ACCEPT_EULA=Y`, strong `MSSQL_SA_PASSWORD` (min 8 chars, 3 of 4 character classes), default Developer edition (free, non-production), port 1433, named volume on `/var/opt/mssql`, healthcheck via sqlcmd (`/opt/mssql-tools18/bin/sqlcmd` on current images). Podman works with the same commands. Images are x86-64 only; emulation is unsupported. Connection string: `sqlserver://localhost:1433;database=bms;user=sa;password=...;trustServerCertificate=true`. Pull the image during P0, it is large. Full nix-vs-docker verdict in Section 12.

**PrismaService layer.** `Layer.scoped` acquiring the adapter-backed client, `$disconnect` on release. Store the layer in a module constant (layer memoization is by reference; one pool, not N).

---

## 4. packages/contract — single source of truth

Everything both sides agree on lives here as Effect Schema. Nothing else defines these shapes.

**Domain enums and metadata**
- `DataSource`: `energyConsumption | hvacPerformance | occupancy | alertsEvents`
- `Aggregation`: `sum | avg | min | max | count` · `CardType`: `kpi | bar | line | gauge`
- `TABLE_META`: per source, every column with `{ name, isNumeric, isTimestamp, label }`, transcribed from the schema above. It is simultaneously the `/api/meta` response AND the server-side whitelist for dynamic queries. One definition, two jobs, zero drift.

**Request/response schemas**
- `CardConfig`: discriminated union on `cardType` (kpi: metric+aggregation; bar: x+y+aggregation; line: timestamp x + y + aggregation + optional groupBy; gauge: metric+aggregation+min+max+target). Optional per-card filter `{ column, value }`.
- `GlobalFilters`: `{ buildingId?, floor?, timeRange: { preset: today|last7d|custom|all, from?, to? } }`
- `QueryRequest = { config, globalFilters }` · `QueryResponse = { rows, meta: { rowCount, executedInMs } }`
- `OccupancyLatestResponse`: per zone — occupancy rate, person count, capacity, co2, AQI, timestamp, `isStale`
- `DashboardState`: cards + react-grid-layout array (localStorage persistence + export/import bonus)
- `LoginRequest { pin }`

**Effect version: v4 beta, matching current effect.solutions.** Bump from the template's effect ^3.22 in P0 and pin the exact v4 beta version (no caret — betas can break between releases). Write the code in the article's v4 idioms directly: `Context.Service` classes with static `layer`, `Schema.TaggedErrorClass` for errors, `Schema.Class` for domain models, `Effect.fn("Service.method")` tracing, layer stored in module constants for memoization. Errors: `ValidationError`, `UnknownColumnError`, `UnauthorizedError`, `DbError`.

Known status and containment: v4 is beta ("API is stable, but minor changes may occur"; the Effect team still recommends v3 for production, and v3 is feature-frozen). Our exposure is deliberately narrow — core `effect` only (Schema, Context, Layer, Effect), no platform/http/cluster — which is exactly the subset whose programming model is unchanged from v3. Contingency if the beta blocks P2: the name-map back to v3 (`Effect.Service`/`Context.Tag`, `Data.TaggedError`) is mechanical, ~1h, decided at the P2 timebox, logged in PROMPT_HISTORY. `@effect/vitest` v4 compatibility gets verified in P0; if it lags, bonus tests use plain vitest + `runtime.runPromise`.

Also export API path constants so client fetches and route files cannot drift.

---

## 5. apps/web/src/server — Effect services

Pattern per the article: contract via tag, implementation via static `layer`, methods wrapped in `Effect.fn("Service.method")`, dependencies resolved in the layer, provided once at the top.

- **MetaService**: TABLE_META from contract + live distincts (buildings, floors, and categorical filter options) via Prisma `findMany distinct` — options come from data, not hardcoded lists (see the Lighting lesson in Section 2).
- **QueryService.execute(request)** — the core:
  1. Semantic validation on top of the route's structural decode: source exists, every referenced column ∈ that source's whitelist, aggregation valid, y/metric must be `isNumeric` unless aggregation is `count`, gauge min < max. Failures → `ValidationError` naming the allowed values (honest errors).
  2. Merge global filters (buildingId/floor equality, timestamp gte/lte from preset via the `now()` helper, or custom range) with the card's own filter.
  3. Two execution paths:
     - **Prisma path** (default): `groupBy` with `_sum/_avg/_min/_max/_count`, `aggregate` for KPI/gauge.
     - **Raw path** (only line-chart hourly bucketing, a real Prisma limitation): `$queryRaw` with SQL Server 2022 `DATETRUNC(hour, ...)`. Identifiers resolve through a literal lookup map keyed by whitelisted column name, never interpolated from input; values go through `Prisma.sql` parameters. ARCHITECTURE.md gets a short proof of why this is injection-safe — the rubric explicitly says "no raw SQL injection risks".
  4. Normalize rows to `{ x, y, series? }`, return with `executedInMs`.
- **OccupancyService.latest(buildingId, floor)**: latest row per zone, `isStale` = older than 1h vs `now()`.
- **AuthService**: `verifyPin` (constant-time via `crypto.timingSafeEqual` against `APP_PIN`), `signSession`/`verifySession` (HMAC-SHA256 over an expiry payload with `AUTH_SECRET` from `openssl rand -base64 32`).

**Runtime + adapter.** `ManagedRuntime.make(Layer.mergeAll(...))` memoized on `globalThis` (Next dev hot-reload would leak pools otherwise, same trick as the classic Prisma singleton). One `handler(schema, effectFn)` helper wraps every route: parse → `Schema.decodeUnknown` → `runtime.runPromise` → tagged errors to HTTP (`ValidationError`/`UnknownColumnError` → 400 with details, `UnauthorizedError` → 401, `DbError` → 500 safe message, full error logged server-side). Client sees what was wrong and what is allowed, never a stack trace.

**Endpoints**
- `GET /api/meta` · `POST /api/query`
- `GET /api/occupancy/latest?building_id=...&floor=...` — **exact path and snake_case params from the PDF**
- `POST /api/auth/login`, `POST /api/auth/logout`

`middleware.ts` verifies the session cookie for everything except `/login` and `/api/auth/*`.

---

## 6. Frontend decisions (decided)

| Concern | Pick | Why |
|---|---|---|
| Drag/drop + rearrange + **resize** | **react-grid-layout v2** | React 19 ready (v2 rewrite, `useContainerWidth` hooks API). Palette drag-in via droppable support, rearrange, remove, resize built in → resize bonus ≈ 30 min. Layout is plain JSON → persistence and export/import bonus fall out free. Grid satisfies "4+ cards without overflow" structurally. Escape hatch: `react-grid-layout/legacy` restores the v1 API 1:1. |
| Charts | **Recharts via shadcn/ui chart components** | Template ships both; consistent theming and dark mode for free. Bar + Line from Recharts. |
| KPI + Gauge | **Custom; gauge is a hand-rolled SVG arc** | ~80 lines, min/max/target markers, threshold colors. Ownership story for the interview. |
| Server state | **TanStack Query** | Card data keyed `[cardId, config, globalFilters]` → a global filter change refetches every card simultaneously (spec). Floor plan `refetchInterval: 30_000` (spec). |
| Client state | **Zustand + persist** | One store: cards + RGL layout → localStorage (spec allows). Global filters stay ephemeral, deliberately not persisted. |
| UI kit | **shadcn/ui + Tailwind v4** | Template configured. Dialog (config modal), Select, Tabs (floor switcher), Tooltip, Skeleton, Badge (severity), Sonner (error toasts). |
| Dark mode (bonus) | next-themes | 30 min with shadcn tokens. |
| Date range | shadcn date picker (react-day-picker) + preset buttons Today / Last 7 days / All data | "All data" default so the single-day 2025-06-01 seed renders immediately; today/7d presets exist per spec and behave via `DEMO_NOW`. |

**Component flow.** Palette (4 card tiles) → drag onto RGL canvas (`isDroppable` + `onDrop`; click-to-add as fallback) → card mounts in config mode → `CardConfigModal` loads `/api/meta`, cascades source → columns, Y-axis options filtered to `isNumeric` → save → TanStack Query hits `/api/query` → renderer per type. Edit reopens the modal with current config; remove deletes card + layout entry. Unconfigured cards show "Configure this card"; Skeleton while fetching; error state surfaces the server's validation message.

**Floor plan page.** One parametric `FloorPlan` + `zoneShapes` config keyed `"BLD-001:1"` etc., containing **exactly the zones from the Section 2 matrix** — BLD-001 F2 is the only 3-zone layout; the rest have A and B. Labeled rects/polygons in a simple office layout (open area, meeting room, server room, reception; imaginative per spec). Fill by occupancy thresholds defined once (<40% green, 40–70% yellow, >70% red). Zone label = name + person count. Hover/tap tooltip with all six required fields (zone+floor, occupancy %, person/capacity, CO2, AQI, timestamp). Tabs for the four building/floor combos. 30s auto-refresh. `isStale` → gray fill + "No data". Nav link next to Dashboard.

**Visual design requirements**: `SeverityBadge` Critical=red / Warning=orange / Info=blue; solid at 1280px minimum; loading and empty states everywhere.

---

## 7. Auth (your addition, out of spec, timeboxed)

PIN is not in the PDF. ~1 hour total, stated in the README ("added beyond spec to demonstrate session handling; a PIN is a demo scheme, not production auth"). Login page → POST pin → constant-time compare → httpOnly, sameSite=lax, signed cookie with expiry → middleware guard. Phase 6, after all required features, never before.

---

## 8. Requirements traceability (required items → where they land)

| PDF requirement | Covered by |
|---|---|
| Add cards by dragging from palette | RGL droppable + palette |
| Rearrange via drag-and-drop | RGL |
| Remove cards | Store action + layout sync |
| Persist layout across refresh | Zustand persist (localStorage) |
| Grid layout, 4+ cards no overflow | RGL 12-col grid |
| KPI / Bar / Line / Gauge with required config | 4 renderers + discriminated `CardConfig` |
| Config mode on add, source → columns from API, axis mapping, reconfigure anytime | CardConfigModal + `/api/meta` |
| Backend constructs and executes query from config | QueryService |
| Global filters: building, floor, time (today/7d/custom) updating all cards | GlobalFilters + TanStack Query keys |
| Floor plan: SVG, zones from CSV data, color by occupancy, label, 6-field tooltip, 4 building/floor combos, 30s refresh, stale>1h gray, in nav | Floor plan page + Section 2 zone matrix |
| Visual: severity colors, 1280px, loading/empty states | SeverityBadge, responsive pass, per-card states |
| Next.js App Router | apps/web |
| Backend integrated via Route Handlers, REST | Section 0, thin handlers |
| MSSQL + Prisma, all queries via Prisma Client | packages/database; raw only for DATETRUNC, whitelisted + parameterized |
| Schema designed from CSV data, migrate, seed via prisma db seed | Sections 2–3 |
| No client-side CSV parsing | Seed script only |
| Deliverable: runnable source | Monorepo |
| Deliverable: README | docker compose up, bun install, migrate, seed, env vars, PIN, DEMO_NOW demo section |
| Deliverable: Architecture Brief (6 named topics) | ARCHITECTURE.md with exactly those six sections: state management, SQL Server→card data flow, DnD strategy, dynamic axis binding, schema decisions, SVG zone overlay approach |
| Deliverable: PROMPT_HISTORY.md | Logged from hour zero, their example's format (prompt → response summary → my decision) + AI% vs own-decision table |
| Deliverable: schema.prisma + seed + **generated client committed** | Custom output dir, committed |

---

## 9. Execution phases (2 days)

**Day 1**
- **P0 Setup (2h)**: copy template; adapt flake/devshell (drop Timescale/Postgres service, add sqlcmd + openssl + prisma-engines env vars per Section 12); `docker pull` + compose up MSSQL; bump effect to pinned v4 beta and verify `@effect/vitest` compatibility; prisma init + config; contract skeleton; update CLAUDE.md. Start PROMPT_HISTORY.md now.
- **P1 Data layer (2.5h)**: schema.prisma from Section 3, migrate, seed with the 80/35/63/20 assertion, `now()`/DEMO_NOW helper.
- **P2 Contract + services (3h)**: contract schemas, TABLE_META, errors; PrismaService, QueryService (both paths), MetaService, OccupancyService; runtime + handler adapter; all routes; curl each endpoint including a deliberate bad column to see the 400.
- **P3 Canvas + cards (4h)**: RGL canvas + palette + remove + persist; config modal; 4 renderers; loading/empty/error states.

**Day 2**
- **P4 Global filters (1.5h)**: FilterBar, presets + custom range, all-cards refetch.
- **P5 Floor plan (3h)**: zoneShapes from the matrix, overlays, tooltip, tabs, 30s refresh, stale gray (verify with DEMO_NOW=23:30).
- **P6 Auth (1h, hard timebox)**.
- **P7 Required polish (2h)**: severity badge in alert-sourced cards, 1280px pass, edge cases (empty result set, count on categorical, invalid config), toasts.
- **GATE: run the production-readiness-review skill (DRIVES) here, before any bonus.** Fix findings. Definition-of-done for required scope.
- **P8 Bonuses, cheapest first**: resize (0.5h) → export/import layout JSON (0.5h) → dark mode (0.5h) → query logging via Prisma `log: ['query']` + duration into `executedInMs` (0.5h) → unit tests with @effect/vitest for QueryService validation + aggregation mapping + occupancy color/staleness helpers (1.5h) → card duplication (0.5h) → real-time clock + current point highlight (1h). Skip extra animations and print/PDF unless time remains.
- **P9 Deliverables (2h)**: README, ARCHITECTURE.md, PROMPT_HISTORY.md final pass, commit generated client, fresh-clone smoke test: `docker compose up -d && bun install && bun db:migrate && bun db:seed && bun dev`.

---

## 10. Risks and pre-decided answers

- **MSSQL locally**: Docker only. Image pull is large; do it in P0.
- **@prisma/adapter-mssql surprises**: fall back to classic connection-string mode; decide in P1, note in PROMPT_HISTORY.
- **RGL v2 droppable friction**: timebox palette drag to 1h with click-to-add interim; drag is required, return to it before P7 ends. Legacy import is the escape hatch.
- **Effect v4 beta breakage**: exposure limited to core modules; pinned exact version; mechanical fallback to v3 names if P2 stalls (~1h), decided at the timebox.
- **Prisma CLI on NixOS**: engines are downloaded binaries that break on NixOS; Section 12 has the devshell fix. If it fights back, run Prisma CLI commands through the Docker path and move on.
- **Recharts**: stay on 2.x (shadcn charts target it). No major bumps mid-test.
- **Time overrun**: cut from the end of P8. Never P7, never a traceability row.

## 11. Interview-facing notes (why this wins the rubric)

- **Data Handling 20%**: whitelist + parameterized raw path answers "no raw SQL injection risks"; the 80/35/63/20 seed assertion answers "CSV import works correctly"; DEMO_NOW + honest empty/stale states answer "handles edge cases". The Lighting-not-in-dictionary catch belongs in ARCHITECTURE.md's schema section as evidence you profiled the data instead of trusting the docs.
- **Architecture 10%**: contract package + services/layers is the extensibility story — "new card type = one schema variant + one renderer; new column = one TABLE_META row".
- **Prompt History 5% and the interview after**: this is the Actual Inc. feedback inverted. Log decisions per session in their example's "My Decision" format. Every judgment call in this plan (Section 0, zone matrix, DEMO_NOW, raw-path safety, data-over-dictionary) is ownership evidence.

---

## 12. Track B — environment, CI, deploy (decided now, executed around the GATE)

None of this is a PDF deliverable. Devshell adaptation is P0 because it is how the work gets done; everything else in this section runs only after the GATE, or in parallel without touching required scope.

### 12.1 MSSQL: Nix allowUnfree vs Docker — research verdict

**The comparison is moot: SQL Server (the server) is not packaged in nixpkgs at all, allowUnfree or not.** There is an open packaging request (nixpkgs #325922, July 2024, still open). What nixpkgs has is client-side only: `unixODBCDrivers.msodbcsql17/18` (unfree ODBC drivers), `sqlcmd` (go-sqlcmd), and JDBC drivers. So Docker is the only local-server path, and it happens to win every axis asked about anyway:

| Axis | Docker (`mssql/server:2022-latest`) | Hypothetical native install (Ubuntu apt; N/A on NixOS) |
|---|---|---|
| Ease | `docker compose up -d`, healthcheck, done | MS apt repo, systemd unit, `mssql-conf` setup |
| Size | ~1.5–2 GB image, one blob, shared across projects | Similar footprint, scattered in /opt, /var/opt, systemd |
| Removable | `docker compose down -v && docker image rm ...` → zero residue | apt purge + manual /var/opt/mssql cleanup |

Notes: needs ≥2 GB RAM for the container; Developer edition (default) is free for dev/test; Azure SQL Edge (the old "small" option) was retired Sept 30, 2025, so there is no lighter official image. Podman is interchangeable if that's the NixOS host setup.

### 12.2 Dev environment sequence: flake first, Docker env second

**Step 1 — devshell.nix (first-class, P0).** Adapted from the template: keep bun, node, typescript tooling; remove the project-local Postgres/Timescale bootstrapping entirely; add `sqlcmd`, `openssl` (AUTH_SECRET generation), and the Prisma NixOS fix. That fix is the one real gotcha: Prisma's npm-downloaded engine binaries are dynamically linked and break on NixOS. Devshell adds nixpkgs `prisma-engines` and exports the engine env vars (`PRISMA_SCHEMA_ENGINE_BINARY`, `PRISMA_QUERY_ENGINE_LIBRARY`; verify exact names against the Prisma version in P0 — with the new `prisma-client` generator + driver adapter, the runtime needs no Rust engine, so this mainly covers the CLI/migrate path). Keep npm `prisma` and nixpkgs `prisma-engines` versions aligned. Definition of "devshell works": `bun install && bun db:migrate && bun db:seed && bun dev` green against the compose MSSQL.

**Step 2 — Docker local environment (after the GATE).** One multi-stage `Dockerfile` for `apps/web` (bun install → turbo build → Next standalone output → slim runtime image), plus a compose `full` profile adding `web` and a one-shot `migrate-seed` service depending on the healthy `mssql`. Reviewer path becomes: `docker compose --profile full up` → app on :3000, zero host tooling beyond Docker. README documents both paths, Docker path first (reviewers won't have Nix). The same image is the deploy artifact for 12.4, so this step is built once and used twice.

### 12.3 CI: GitHub Actions + self-hosted Turborepo Remote Cache (on your GCP)

Per the Turborepo docs: any HTTP server implementing the Remote Cache API spec works (all current `turbo` versions speak the v8 endpoints), configured via `turbo login --manual` locally and env vars in CI. Pick: `ducktors/turborepo-remote-cache` — it is on Turborepo's community list, supports `STORAGE_PROVIDER=google-cloud-storage` (bucket name via `STORAGE_PATH`), and **ships an official "Deploying as a Cloud Run Service" guide**. So the whole cache runs on the GCP access you already have, zero new infra:

- **Cache server**: Cloud Run service from the pre-built image `ducktors/turborepo-remote-cache:latest`, per their guide: port 3000, HTTP/2 end-to-end, min instances 0 / max 1 (single-writer bucket assumption), `TURBO_TOKEN` = strong random secret. Their recipe mounts the GCS bucket as a Cloud Run volume at `/turbo-cache` with `STORAGE_PROVIDER=local`; the direct `STORAGE_PROVIDER=google-cloud-storage` mode is the alternative. Scale-to-zero means it costs ~nothing between builds.
- **Storage**: your existing bucket (or a dedicated `turbo-cache` bucket, uniform access, no public access; add a lifecycle rule deleting objects older than a few weeks, as their guide suggests).
- **GitHub Actions**: workflow (lint → typecheck → test → build via `turbo run`) with `TURBO_API=https://<service>.run.app`, `TURBO_TEAM=<slug>`, `TURBO_TOKEN` from repo secrets.
- **Integrity**: `"remoteCache": { "signature": true }` in turbo.json + `TURBO_REMOTE_CACHE_SIGNATURE_KEY` in CI secrets and local env (HMAC-SHA256 signed artifacts; verification failures are treated as cache misses).
- Fallbacks, in order: ducktors on the Hetzner VPS with Garage S3 (the previous plan), or a GitHub-Actions-cache-backed emulation action.

Timebox: 1.5h total, after the GATE. CI proves professionalism; it must never eat required scope.

### 12.4 Deploy target: GCP primary (given existing access), VPS fallback — verdict

Deployment is not a deliverable; a live URL is a differentiator. The earlier verdict favored the VPS because SQL Server licensing made Cloud SQL the expensive option. **With Cloud SQL + Cloud Run + bucket access already in hand, that cost argument falls away and GCP wins**: fully managed, nothing to babysit during interview weeks, a documented architecture that reads well in ARCHITECTURE.md, and "Connect from Cloud Run" is an officially documented pattern for Cloud SQL for SQL Server.

Architecture:
- **Image**: the 12.2 Dockerfile pushed to Artifact Registry. One image serves local full-Docker, CI, and deploy.
- **Database**: Cloud SQL for SQL Server, **Express edition** (no SQL Server license component in pricing; its limits — 10 GB per DB — are irrelevant for 198 rows), smallest machine type, **private IP only** (`--no-assign-ip`).
- **App**: Cloud Run service running the image, reaching the DB over **private IP :1433 via Direct VPC egress** (the documented path; Serverless VPC Access connector and the Auth Proxy sidecar are the alternatives). `DATABASE_URL` points at the private IP; secrets in Secret Manager; `DEMO_NOW` set so reviewers land on populated dashboards; min instances 0 (cold starts are fine for a demo).
- **Migrate + seed**: a Cloud Run **Job** using the same image with the command swapped to `migrate deploy && seed`. Run once after DB creation, rerun on schema change.
- **Cost/teardown honesty** (belongs in ARCHITECTURE.md): Cloud Run scales to zero, Cloud SQL does not — the instance bills while it exists. Stop it between demo periods, and teardown is `gcloud sql instances delete` + `gcloud run services delete` + the job. Removability stays one command per resource.

**VPS fallback** (previous plan, kept warm): same image via compose `prod` profile (web + mssql + caddy) on a ≥4 GB Hetzner instance at `bms-demo.indr.web.id`. Use it if GCP access is limited, quota-bound, or shared in ways that make a public demo awkward. One paragraph comparing both in ARCHITECTURE.md is itself production judgment on display.

### 12.5 Track B sequencing

P0: devshell (12.2 step 1). GATE passes → 12.2 step 2 (Dockerfile + full profile; doubles as deliverable polish for "runnable"), then 12.3 CI + Cloud Run cache server, then 12.4 GCP deploy if time remains (Artifact Registry push → Cloud SQL Express → Cloud Run Job migrate/seed → Cloud Run service). Any Track B item that threatens P9 deliverables gets dropped without discussion — README/ARCHITECTURE/PROMPT_HISTORY outrank all of it.
