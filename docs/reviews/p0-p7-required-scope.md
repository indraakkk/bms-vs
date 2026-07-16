# Production Readiness Review — BMS dashboard, required scope (P0–P7)

Verdict: **Fix first**   |   Blockers: **2**

Scope reviewed: the P0–P7 application — `apps/web/src/**` (route handlers,
Effect services, proxy, auth), `packages/contract/src/**` (schemas, domain
whitelist, errors), `packages/database/**` (schema, seed). Method: traced
concrete bad inputs through the query, auth, and occupancy paths; verified
the raw-SQL injection guard end-to-end.

The core is genuinely well-built: the raw-SQL identifier whitelist is
injection-safe (confirmed by trace), tagged errors map to honest statuses,
defects are logged server-side and never leak a stack trace, and the
indexes match the filter shape. The findings below are the unhappy-path
gaps a demo doesn't exercise. Nothing here is a security breach or a
data-corruption risk; the two blockers are "normal invalid input returns a
500," which the DRIVES rubric classifies as do-not-ship.

---

## Blockers (must fix before "done")

- **[R][Blocker] `apps/web/src/server/query.ts:143` (`coerceFilterValue`) + `packages/contract/src/schemas.ts:4` (`CardFilter.value`)** —
  A per-card filter on a **numeric** column with a non-numeric value is not
  validated. `coerceFilterValue` blindly does `Number(value)`, so
  `Number("abc") = NaN` reaches Prisma as `where: { energyKwh: NaN }` and
  fails as an unhandled defect → generic **500** (or, if the driver coerces,
  a silently-wrong empty result).
  Input tried: bar card, source `energyConsumption`, filter column
  `energyKwh`, filter value `"abc"`. **UI-reachable** — the "Filter value"
  box in `card-config-modal.tsx:401` is a free-text `<Input>` even when the
  selected filter column is numeric.
  → In `validateConfig`, when the filter column's `dbType === "number"`,
  require `Number.isFinite(Number(value))`; else fail
  `ValidationError` → 400 `Filter value for "<col>" must be a number`.

- **[R][Blocker] `apps/web/src/server/query.ts:133-134` (`resolveTimeRange` custom branch)** —
  A `custom` time range with an unparseable bound yields
  `new Date("banana")` = Invalid Date, which flows into the Prisma
  `where.timestamp` range and fails as a defect → generic **500**.
  `validateGlobalFilters` (query.ts:103) checks only that `from`/`to` are
  *present*, never that they parse or that `from <= to`.
  Input tried: `POST /api/query` with
  `globalFilters.timeRange = { preset:"custom", from:"banana", to:"x" }`.
  API-reachable (any authenticated caller); the calendar UI itself always
  emits valid ISO, so this is a raw-API gap.
  → In `validateGlobalFilters`, parse both bounds; fail `ValidationError`
  → 400 if either is `Invalid Date` (`Number.isNaN(d.getTime())`) or if
  `from > to`.

Both blockers share one root cause: values that pass the `Schema.String` /
`Schema.Number` *shape* check but are semantically invalid for their target
reach Prisma and surface as a server error instead of an honest 400.

---

## Findings by dimension

### D — Input contracts
- **[D][Minor] `packages/contract/src/schemas.ts:95-103`** — `GlobalFilters.floor`
  and `buildingId` accept any number/string; unknown values return empty
  results, not a 400. Low impact (UI dropdowns constrain to live values).
- **[D][Minor] `packages/contract/src/schemas.ts:36-45`** — gauge `target`
  is not validated to lie within `[min,max]` (only `min < max` is enforced,
  server-side at query.ts:56). Cosmetic (needle renders out of range).
- **[D][Minor] `apps/web/src/server/db-columns.ts:74` vs `domain.ts` TABLE_META** —
  `DB_COLUMN.alertsEvents` has a `description` key that `TABLE_META.alertsEvents`
  omits: two hand-maintained maps that have drifted. Harmless today
  (validation is via TABLE_META, so `description` is unreachable, and
  `TABLE_META ⊆ DB_COLUMN` still holds so there's no `undefined`-in-raw-SQL),
  but exactly the drift a one-line invariant test should lock down (see S).

### R — Error honesty
- The two blockers above.
- Everything else is honest: tagged errors → documented 400/401, defects →
  logged in full server-side + generic `{ "InternalError": "Something went
  wrong" }` 500 with no stack-trace leak (`http.ts:52-60`). Good.

### I — Isolation & security
- **[I][Major] `apps/web/src/app/api/auth/login/route.ts`** — no rate
  limiting / attempt throttling on PIN login, and `APP_PIN` defaults to a
  4-digit numeric (`"1234"`, `.env.example:9`) → brute-forceable (10^4) in
  seconds. Constant-time compare (`session-token.ts:12`) blocks timing leaks
  but not guessing.
  → Add a small per-IP fixed-window limiter (e.g. 5 attempts / minute → 429).
  *Severity note (owned):* the author explicitly scopes this as "a demo
  scheme, not production auth" over non-PII building data — in a real deploy
  this is a Blocker; rated **Major** here because the scheme is a conscious
  demo, but the fix is cheap and I'd want it before calling auth "done."
- Injection: **clean.** Raw-SQL identifiers resolve through the `DB_COLUMN`
  whitelist keyed by an already-TABLE_META-validated column name; every value
  goes through `Prisma.sql` parameters. Confirmed no request string reaches
  `Prisma.raw` un-whitelisted.
- Session cookie is `httpOnly` + `sameSite:lax` + `secure` in prod; HMAC over
  payload, constant-time signature check, expiry enforced. Sound. No
  cross-tenant surface exists (single shared dataset + single shared PIN, by
  design).

### V — Scale & failure
- **[V][Major] `apps/web/src/server/occupancy.ts:30-35`** — `latest()` runs
  `findMany({ where:{buildingId,floor}, orderBy:{timestamp:desc} })` with no
  `take`, loading the **entire history** for that building+floor into memory
  to keep the newest row per zone in JS. Breakpoint: a floor with a year of
  5-minute occupancy ≈ 10^5 rows/zone, all transferred and heap-held per
  request for a handful of latest-per-zone results. Owned as deferred (the
  code comment) but the comment understates the breakpoint.
  → Push it to SQL: `ROW_NUMBER() OVER (PARTITION BY zone ORDER BY timestamp
  DESC) = 1`. The `[buildingId,floor,timestamp]` index already supports it.
- **[V][Minor] `apps/web/src/server/http.ts:73` + login route** — `request.json()`
  buffers the whole body with no size cap (App Router route handlers don't
  apply the old Pages-API 4 MB limit). A large POST is read fully into memory.
  → Add a `Content-Length` guard on `/api/query` and `/api/auth/login`.
- Aggregations (kpi/bar/line) correctly push work to the DB and hit the
  `[buildingId, timestamp]` indexes. A `floor`-only filter (no building) on
  energy/hvac/alerts is not index-covered, but the UI always pairs building +
  floor — acceptable.

### E — Decision ownership
- **[E][Major] all DB calls use `Effect.promise` (`query.ts:187,192,211,279`,
  `occupancy.ts:30`, `meta.ts:18`) while `DbError` (`errors.ts:38`) is defined
  and mapped to 500 (`http.ts:47`) but never raised.** So a DB failure becomes
  an *untyped defect*, not the `DbError` the infra was clearly built for; the
  `execute` signature (`ValidationError | UnknownColumnError`) is silent about
  DB failure, and the `DbError` branch is dead code. This is an unowned
  inconsistency, not a runtime bug (the defect still 500s honestly).
  → Pick one and state it: (a, recommended) wrap DB calls in
  `Effect.tryPromise({ catch: () => new DbError({ message: "Database query
  failed" }) })` and add `| DbError` to the signatures — wires the existing
  infra; or (b) delete `DbError` + its http branch and document that DB
  failures are intentionally defects.
- **[E][Minor] `apps/web/src/server/env.ts`** — env vars are lazy getters
  validated only on first access, and `required()` checks truthiness only
  (no min length on `AUTH_SECRET`, no PIN format). A deploy missing
  `AUTH_SECRET` boots fine and 500s on first login instead of failing fast.
  → Validate all three at startup; enforce a minimum `AUTH_SECRET` length.
- Well-owned decisions worth keeping in the log: the whitelist-map injection
  guard; the single-PIN HMAC-cookie demo auth; `reactStrictMode:false`
  (documented + prod-build-verified RGL v2 × StrictMode interaction);
  `dbType` vs `isNumeric` split; TABLE_META as dual whitelist + `/api/meta`.

### S — Proof / tests
- **[S][Major] repo-wide — no automated tests on the highest-risk logic.**
  No runner, no `test` script, no `*.test.ts`. The only automated evidence is
  the seed row-count assertion (`seed.ts:180-189`, good but only proves count,
  not that numeric cells parsed — an all-NaN column would still pass). The
  riskiest logic is entirely unproven: QueryService validation (unknown
  column, non-numeric + sum/avg, line-x-must-be-timestamp, gauge min≥max,
  timestamp-as-per-card-filter rejection), the raw-SQL whitelist guard, and
  `session-token` sign/verify/tamper/expiry.
  → Add a small `vitest` suite. The validation, token, and TABLE_META⊆DB_COLUMN
  invariant tests need no database.

---

## Decision log (ownership)

- **Raw-SQL identifiers via `DB_COLUMN` whitelist, values via `Prisma.sql`
  params:** why — SQL Server `DATETRUNC` hourly bucketing needs `$queryRaw`,
  and identifiers can't be parameterized; trade-off — a second hand-maintained
  map (mitigate with the invariant test); at scale — unchanged, this is the
  right shape. **Sound; the load-bearing security decision, and it holds.**
- **Single shared PIN, HMAC-signed cookie, constant-time compares, no JWT
  lib:** why — demonstrate session handling beyond spec without a dependency;
  trade-off — no per-user identity/rotation and (currently) no brute-force
  throttle; at scale — real IdP + per-user sessions + rate limiting.
- **`Effect.promise` for DB calls:** currently **under-owned** — see [E][Major];
  choose defect-vs-`DbError` and encode the reason.
- **`reactStrictMode:false`:** why — RGL v2 controlled-layout effect isn't
  idempotent under StrictMode's double-invoke (dev-only infinite loop);
  trade-off — loses StrictMode's other dev checks app-wide; verified absent in
  a production build. Owned.
- **Indexes `[buildingId,(floor,)timestamp]`:** why — matches the
  building/floor/time filter shape; trade-off — floor-only (no building)
  filters aren't covered; acceptable given the UI pairs them.

---

## Fix plan (ordered)

1. **Blocker R1** — numeric filter-value validation in `validateConfig`
   (`query.ts`): if the filter column is `dbType:"number"`, require a finite
   `Number(value)`, else 400.
2. **Blocker R2** — custom-range validity + order check in
   `validateGlobalFilters` (`query.ts`): reject Invalid Date and `from > to`
   with 400.
3. **[E] DbError** — wire DB calls through `Effect.tryPromise` → `DbError`
   (add `| DbError` to signatures), or delete the dead `DbError` path.
4. **[I] Login throttle** — per-IP fixed-window attempt limiter → 429.
5. **[S] Tests** — `vitest` suite: QueryService validation cases, an
   injection-guard assertion, session-token round-trip/tamper/expiry, and the
   `TABLE_META ⊆ DB_COLUMN` invariant (catches the `description` drift).
6. **[V] Occupancy** — convert `latest()` to a windowed SQL query, or
   explicitly defer with the breakpoint documented in the comment.
7. **Minors** — env fail-fast + `AUTH_SECRET` min length; body-size guard on
   POST routes; optional global-filter value validation; gauge `target` range.

---
*Note: this report lives at `docs/reviews/p0-p7-required-scope.md`, which is
currently untracked by git. Commit it if you want it version-controlled with
the repo.*
