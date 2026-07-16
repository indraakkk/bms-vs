# Architecture Brief

Six topics, as required: state management, SQL Server→card data flow,
drag-and-drop strategy, dynamic axis binding, schema decisions, and the
SVG floor-plan overlay approach.

## 1. State management

Three deliberately separate stores, split by lifetime and lifecycle, not
lumped into one:

- **Dashboard layout** (`stores/dashboard-store.ts`, Zustand +
  `persist`): the card list and react-grid-layout positions. Persisted to
  `localStorage` — a refresh should restore exactly what was there,
  per spec. `draggingCardType` (which palette tile is mid-drag, used to
  size the RGL drop ghost) lives in the same store for convenience but is
  excluded from persistence via `partialize` — it's interaction state,
  not layout state, and persisting it would let a stale value leak across
  reloads.
- **Global filters** (`stores/filter-store.ts`, plain Zustand, no
  persist): building/floor/time-range. Deliberately *not* persisted —
  trapping a returning user in a stale filter (e.g. "today", now showing
  nothing because a day has passed) is worse than resetting to the "all
  data" default every load.
- **Server data** (TanStack Query): every card's query result, `/api/meta`,
  and `/api/occupancy/latest` are server cache, not client state — they're
  fetched, cached, and invalidated by query key, never manually synced.
  The key insight for the "global filter change refetches every card"
  requirement: `useCardQuery`'s query key is `["card-query", cardId,
  config, filters]`, where `filters` comes from the shared filter store.
  Changing any filter changes that key for *every* mounted card
  simultaneously, and TanStack Query's own refetch machinery does the
  rest — no manual "notify all cards" event bus needed.

Ephemeral UI state (which card's config modal is open, form field values
mid-edit) stays as local `useState` in the relevant component — it never
needed to be global.

## 2. SQL Server → card data flow

A card's `CardConfig` (source, axes, aggregation, optional filter) is the
single thing that travels from browser to database and back:

1. **Client** — `CardConfigModal` builds a `CardConfig` (validated at the
   type level by `@bms/contract`'s discriminated union) and TanStack
   Query POSTs it, plus the current `GlobalFilters`, to `/api/query`.
2. **Route handler** (`app/api/query/route.ts`) — a ~10-line adapter:
   decode the JSON body against the contract schema, hand off to
   `QueryService.execute`, map the result or tagged error to a `Response`.
   All of this indirection lives in `server/http.ts`'s shared
   `handleJson`/`toResponse` helpers, so every route's error-to-HTTP
   mapping is one implementation, not copy-pasted per route.
3. **`QueryService.execute`** (`server/query.ts`) — the real logic, in
   three steps:
   - **Semantic validation**: every column reference (`x`, `y`, `metric`,
     `groupBy`, filter column) is checked against `TABLE_META` — the same
     whitelist `/api/meta` serves to the client, so the two can never
     drift. A `sum`/`avg`/`min`/`max` aggregation on a non-numeric column
     is rejected with a message naming what's allowed; `count` is exempt
     since it's valid on any column.
   - **Filter merge**: global building/floor/time-range filters combine
     with the card's own optional filter into one Prisma `where` clause.
   - **Execution — two paths.** KPI/gauge/bar go through Prisma's typed
     `aggregate`/`groupBy` — no raw SQL. Line charts are the one
     exception: Prisma has no hourly-bucketing primitive, so that path
     uses `$queryRaw` with SQL Server 2022's `DATETRUNC(hour, ...)`.
     **Why this is injection-safe**: every identifier in the raw SQL
     (table name, column name) is resolved through `db-columns.ts`'s
     explicit camelCase→snake_case lookup maps — a static, hand-written
     table, not a computed string — and only *after* the column has
     already passed the `TABLE_META` whitelist check in step 1. A request
     can never make it to the point of touching raw SQL with a column
     name that wasn't already validated. All *values* (filter values,
     date bounds) go through `Prisma.sql`'s tagged-template
     parameterization, never string interpolation.
4. **Response** — rows normalize to `{ x, y, series? }` regardless of
   which path produced them, so every card renderer consumes one shape.

## 3. Drag-and-drop strategy

`react-grid-layout` v2 (a from-scratch TypeScript rewrite, not the
familiar v1 API — see `PROMPT_HISTORY.md`'s P3 entry for what changed
and why it mattered here). Three interaction modes, all backed by the
same `layout` array in the dashboard store:

- **Palette → canvas drag**: palette tiles are native HTML5
  `draggable` elements; `GridLayout`'s `dropConfig`/`droppingItem`/
  `onDrop` props handle the ghost placeholder and final drop position.
- **Click-to-add**: the same palette tile's `onClick` calls `addCard`
  directly, placing the new card at the bottom of the existing layout —
  the required fallback for drag, and just as fast to use.
- **Rearrange/resize**: native to `GridLayout` once cards exist —
  dragging repositions, the default `'se'` resize handle resizes. No
  custom code; the library's default behavior already satisfies the
  "4+ cards without overflow" grid requirement.

New layouts (from `addCard`) are run through RGL's own exported
`verticalCompactor.compact()` before being committed to the store — a
library-internal function reused rather than a hand-rolled bin-packing
approximation, so externally-added cards always land in a valid,
non-overlapping slot exactly the way an interactive drag would resolve
one.

## 4. Dynamic axis binding

`TABLE_META` (`packages/contract/src/domain.ts`) is the mechanism the
whole "config mode on add, source → columns, axis mapping" flow is built
on — one array of `{ name, label, isNumeric, isTimestamp }` per data
source, serving two jobs from one definition:

- **Client**: `/api/meta` returns it verbatim; `CardConfigModal` uses it
  to cascade — selecting a source populates that source's column list;
  selecting `count` as the aggregation unlocks non-numeric columns in the
  Y-axis dropdown (otherwise filtered to `isNumeric`); a line chart's X
  dropdown is filtered to `isTimestamp` columns only.
- **Server**: `QueryService` validates every incoming column reference
  against the exact same array. A column the UI would never let a user
  pick (because it's not in `TABLE_META`) is also a column the server
  will never execute a query against — there's no second, independently
  maintained whitelist that could drift out of sync with the first.

Extending this to a new card type or a new column is the story this
buys: a new column is one `TABLE_META` row (both the picker and the
validator update from that one line); a new card type is one
`CardConfig` union variant plus one renderer component.

## 5. Schema decisions

Modeled from the **actual CSVs** (`data/*.csv`, profiled directly), not
transcribed from `data/DATA_DICTIONARY.md` — the two disagree in
verifiable ways, and the schema follows the data:

- **`category: "Lighting"` appears in `alerts_events.csv` but not in the
  dictionary's documented category list.** Categorical columns
  (`buildingId`, `zone`, `severity`, `category`, …) are all modeled as
  plain `String` in `schema.prisma`, never a SQL Server enum/check
  constraint — an undocumented-but-real value like this one ingests
  without any schema change. Filter dropdowns get their option lists
  from live `distinct` queries (`MetaService`), never a hardcoded list,
  for the same reason.
- **`resolvedAt` is the only nullable column in the entire schema** — 9
  of `alerts_events.csv`'s 20 rows have an empty `resolved_at`
  (unresolved alerts), every other column across all four tables is
  fully populated. Confirmed by profiling the CSVs before writing the
  schema, not assumed.
- **`floor` is `Int` at the database level but excluded from
  `TABLE_META`'s `isNumeric` set.** It's a real numeric column, but
  summing or averaging a floor number is meaningless — `isNumeric` marks
  "valid Y-axis/metric for aggregation," not "SQL numeric type," so
  dimension columns that happen to be numeric-typed (`floor`) are treated
  the same as `buildingId` or `zone`: fine for `count` or as an X-axis
  group key, excluded from the sum/avg/min/max metric picker.
- **`alertId` is the natural primary key** for `alerts_events`
  (`ALT-0001`…`ALT-0020`, verified unique across all 20 rows) rather than
  a synthetic autoincrement — the other three tables use autoincrement
  `id` since their CSVs have no natural per-row identifier.
- **Prisma 7's `prisma-client` generator, TypeScript output, committed**
  (`packages/database/src/generated/`) — per the take-home's explicit
  "include the generated Prisma Client in your source code" deliverable.
  Runtime queries go through `@prisma/adapter-mssql` (a JS `mssql`
  driver adapter), so no native Rust query engine binary is needed at
  runtime — only the schema engine, for the CLI's migrate path (see the
  root `CLAUDE.md`'s devshell notes).

## 6. SVG floor-plan overlay approach

`ZONE_SHAPES` (`components/floor-plan/zone-shapes.ts`) is a parametric,
hand-authored layout keyed `"BLD-XXX:floor"`, drawn against the *verified*
zone matrix from profiling `occupancy.csv` — every floor has Zone-A and
Zone-B; BLD-001's second floor is the only one that also has Zone-C. The
component never draws a zone the occupancy data doesn't actually have,
and never fabricates one for a "nicer-looking" layout: the 3-zone floor
splits its second room into a dedicated "Server Room" rather than
inventing a fourth zone, and the page's decorative "Reception" strip
carries no occupancy data at all (there's no seed data for a lobby zone —
showing a number there would be fabricated, not "imaginative").

Each real zone renders as an SVG `<rect>` inside a `<Tooltip>` (from
shadcn/Radix) wrapping the whole `<g>` group — label, room name, and
person count are all part of the hover/tap target, not just the
rectangle. Fill color comes from one shared function
(`occupancyFill`) applied consistently to both the floor plan and (via
the same `STATUS` palette) the gauge card: `<40%` green, `40–70%` amber,
`>70%` red, or a flat gray + "No data" label when the zone's latest
reading is more than an hour old (`isStale`, computed server-side in
`OccupancyService` against the same `DEMO_NOW`-aware clock the rest of
the app uses). Tabs switch between the four building/floor combinations;
each tab's `FloorPlanSvg` polls `/api/occupancy/latest` independently
with `refetchInterval: 30_000`, so only the visible tab's zones refresh
live, not all sixteen zones across four floors simultaneously.
