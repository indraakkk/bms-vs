# Production Readiness Review — full app vs. "TECHNICAL TEST (1).pdf" expected results

Verdict: **Ship** | Blockers: **0 open** (2 found, both **fixed and re-verified live during this review**)

Scope: the complete take-home at HEAD (`aacdc94`) measured against the requirement
PDF's expected results — requirements R1–R6, technical constraints, deliverables,
and evaluation criteria — plus a full DRIVES pass over the API boundary
(`apps/web/src/app/api/**`, `src/server/**`, `src/proxy.ts`), the contract
(`packages/contract`), the data layer (`packages/database`), and the client
boundary (import, filters, renderers, persistence).

Method: every claim below is backed by either a live probe against the running
dev server + seeded MSSQL (curl transcripts reproduced in this doc) or a direct
file read. This review builds on `docs/reviews/p0-p7-required-scope.md` (the P7
GATE): both of that review's blockers were re-confirmed still open at HEAD and
are now fixed; its Majors are re-assessed below.

---

## What was fixed during this review

All server-side, verified by typecheck + lint + production build + live curl
before/after; happy-path responses byte-identical to pre-fix values.

1. **[R][Blocker — FIXED] `apps/web/src/server/query.ts` `validateGlobalFilters`** —
   a `custom` time range with an unparseable bound (`from:"banana"`) flowed into
   the Prisma where-range as an Invalid Date and died in the driver → generic
   **500**. Also `from > to` silently returned an empty 200.
   Now: `400 '"from" and "to" must be valid ISO-8601 timestamps'` /
   `400 '"from" must not be after "to"'`. Probed before (500) and after (400).

2. **[R/D][Blocker — FIXED] `query.ts` `validateConfig` filter block** — a
   per-card filter on a numeric column with a non-numeric value coerced through
   `Number("abc") = NaN` → `WHERE col = NaN` → **silent empty 200**,
   indistinguishable from genuinely absent data (worse than a 500: it looks like
   truth). Empty-string values likewise coerced to `0`.
   Now: `400 'Filter value "abc" is not a number — column "value" is numeric'`
   and `400 'Filter value for column "floor" must not be empty'`. Verified on
   both execution paths (Prisma `aggregate`/`groupBy` and the raw-SQL line-chart
   path). The card UI surfaces these via its existing error state, so the user
   now sees *why* instead of a fake-empty card.

3. **[E][Major — RESOLVED] dead `DbError` / untyped DB failures** — `DbError`
   was defined, mapped to 500 in `http.ts`, and never raised; every DB call used
   `Effect.promise`, so real DB failures were untyped defects and service
   signatures hid them. Decision now owned and encoded: new `tryDb` helper in
   `src/server/prisma.ts` wraps all six DB call sites (`query.ts` ×4,
   `occupancy.ts`, `meta.ts`) — the full underlying error is logged server-side,
   callers get typed `DbError`, and `| DbError` appears in all three service
   signatures. Proven live: an Int-overflow filter value (`1e20` on `floor`)
   returns `{"error":"DbError","message":"Database query failed"}` (500) while
   the server log carries the complete Prisma error. No internals leak.

---

## Expected results vs. the PDF (requirements compliance)

| Req | Status | Evidence / notes |
|---|---|---|
| R1 Drag-and-drop canvas (add/rearrange/remove/resize/persist, ≥4 cards) | **Met** | Palette drag + click-to-add (`palette.tsx:35-41`, `dashboard-canvas.tsx:59-72`); header-handle rearrange; remove; resize via RGL default SE handle (works, but only via library default config — note); Zustand `persist` v1 with migration (`dashboard-store.ts:172-193`); 12-col grid fits 4+ cards (KPI `w:3`). |
| R2 Four card types + required config fields | **Met** | All four configs match the PDF's required-field lists (`card-config-modal.tsx`, contract `schemas.ts`); real Recharts/SVG visuals, no placeholders. All four verified live through `/api/query` (sum 2,236.6 kWh; severity counts 4/7/9; hourly series; gauge 28.3%). |
| R3 Dynamic axis selection (config mode → source → columns from API → axes → query → immediate render → reconfigure) | **Met** | New card opens config mode with `config:null`; columns fetched from `/api/meta`; save → `POST /api/query` → immediate render; pencil reopens with saved config. Note: columns come from the contract's `TABLE_META` whitelist served by the backend (deliberate — it doubles as the injection whitelist), not live introspection. |
| R4 Global filters (building, floor, time: today / last 7d / custom) update all cards | **Met** | `filter-bar.tsx`; refetch-all is structural — every card's TanStack key embeds the shared filter store (`use-card-query.ts:15`). Custom range emits UTC-day-bounded ISO only; reversed ranges are impossible in the picker (react-day-picker swaps them — verified in its source). |
| R5 Floor plan (SVG zones, color fill, labels, 6-field tooltip, 4 building/floor tabs, `/api/occupancy/latest`, 30s refresh, stale>1h gray "No data") | **Met, one deviation** | All zones from real data as distinct regions (BLD-001 F2 = the only 3-zone floor); tooltip carries all six required fields (verified in the live payload); tabs cover all four combos; `refetchInterval: 30_000`; staleness computed server-side at exactly 1h. **Deviation:** fill hues are low=gray / mid=green / high=red vs. the PDF's "e.g. green/yellow/red" — see owner decisions. |
| R6 Visual design (professional, 1280px, severity colors, titles, loading/empty states) | **Met, one deviation** | Loading shimmer, error, empty, and unconfigured-card states all present (`card-shell.tsx:33-122`); 1280px verified in P8. **Deviation:** PDF *prescribes* Critical=red / Warning=orange / Info=blue; implementation has Warning=mono, Info=gray (red reserved for Critical, per the approved design mock) — see owner decisions. |
| No client-side CSV parsing | **Met** | Zero CSV handling in `apps/web/src` (grep-verified); papaparse only in the seed script. All data flows CSV → MSSQL → Prisma services → JSON API → renderers. |
| Prisma for all queries / no raw-SQL injection risk | **Met** | Only the line-chart hourly bucketing uses `prisma.$queryRaw` (SQL Server `DATETRUNC`); identifiers resolve exclusively through the `DB_COLUMN` whitelist keyed by TABLE_META-validated names; values are `Prisma.sql` parameters. Map completeness machine-checked this review: every TABLE_META column has a DB mapping (one harmless extra key, see D-findings). |
| Deliverables 1–5 | **Met** | README, ARCHITECTURE.md, PROMPT_HISTORY.md, `schema.prisma` + seed with exact row-count assertion (80/35/63/20), generated Prisma client committed (12 files). |

Bonus scoreboard (PDF optional items): resizing ✓, export/import JSON (schema-validated on import) ✓, dark mode ✓, card duplication ✓, real-time clock (sidebar) + "current" end-dot pings ✓, animated add/rearrange transitions ~ (RGL defaults), print/PDF ✗, unit tests ✗, query logging ~ (per-response `rowCount`/`executedInMs`, no SQL statement log).

---

## Findings by dimension

### D — Input contracts
- **[D][Fixed]** per-card `filter.value` semantic validation (numeric-column and empty-value rules) — was the blocker above.
- **[D][Minor]** `GlobalFilters.buildingId`/`floor` accept any string/number; unknown values return an honest empty result, and the UI constrains to live `/api/meta` values. Accepted.
- **[D][Minor]** Gauge `min`/`max`/`target` are unbounded `Schema.Number`: JSON `1e999` parses to `Infinity` and passes `min < max`; `target` may lie outside `[min,max]` (tick pins to the rail while the label shows the raw number; a cleared field saves `target: 0`). Render-only impact — the values never reach the DB. → Fix plan #8.
- **[D][Minor]** `DB_COLUMN.alertsEvents` carries a `description` key absent from `TABLE_META` — drift between the two hand-maintained maps, in the *safe* direction (`TABLE_META ⊆ DB_COLUMN` holds, machine-checked this review; validation runs against TABLE_META so the extra key is unreachable). → lock with the invariant test, fix plan #3.
- **[D][Minor]** No request body size cap on POST routes (App Router has no default limit); a huge body is buffered before decode. → Fix plan #7.

### R — Error honesty
- Both blockers fixed (above). The boundary is now honest end-to-end: schema-shape violations → 400 with the decode path; semantic violations → 400 naming the constraint and (for columns) the allowed list; auth → 401; DB failure → typed 500 `"Database query failed"` with the real error server-side only. Re-probed: no stack traces, SQL text, or internals in any error body.
- **[R][Minor — accepted]** an Int-range-overflowing numeric filter value (e.g. `1e20` for `floor`) is a 500 (`DbError`), not a 400 — bounds-checking every Int column against SQL ranges isn't worth the surface; the failure is logged, typed, and leaks nothing.
- **[R][Minor]** `lib/api.ts` trusts response JSON without decoding (the import path decodes; the fetch path casts). Own-backend trust boundary — accepted with note.

### I — Isolation & security
- **Injection: clean** (re-verified this review — map completeness + parameterized values + live probes).
- **Auth guard: complete** — every page and API route except `/login` + `/api/auth/*` (401 for API, redirect for pages; probed unauthenticated). Cookie is httpOnly/SameSite=lax/secure-in-prod; HMAC verify and PIN compare are constant-time; expiry enforced; open-redirect on `from` already fixed in P7.
- **[I][Major — accepted, owned]** no rate limiting on `POST /api/auth/login` (6 rapid wrong PINs, no pushback — probed). With the dev PIN `1234` this would be trivially brute-forceable, but the dev hint/PIN are development-build-only and the documented production PIN is `openssl rand -hex 16` (128 bits — unguessable without throttling anyway). Single-tenant demo auth *beyond the PDF's spec*. In any real deployment this becomes a Blocker. → Fix plan #1.
- No secrets in logs or responses; `AUTH_SECRET` only feeds the HMAC.

### V — Scale & failure
- **[V][Major — deferred, owned]** `occupancy.ts` `latest()` fetches the *entire* building+floor history (`findMany`, no `take`) to pick newest-per-zone in JS. Breakpoint: ~10⁵ rows per floor-year at 5-minute cadence, per request, on a 30s auto-refresh page. Fine at the seeded 63 rows; the fix is a `ROW_NUMBER() OVER (PARTITION BY zone ORDER BY timestamp DESC)` window query the existing `[buildingId, floor, timestamp]` index already serves. → Fix plan #4.
- **[V][Minor]** KPI sparkline = a second query per KPI per filter change — deliberate (honest server data over client fabrication), cached under the standard query-key discipline. Accepted.
- **[V][Minor]** No explicit DB timeout tuning (adapter defaults); DB-down now surfaces as typed `DbError` 500s and error-state cards rather than hangs (Prisma's own connect timeout bounds it). Accepted for the demo.
- Aggregations push work to the DB and ride the `[buildingId, timestamp]` indexes; line-chart row counts are bounded by hours-in-range × series cardinality — honest `rowCount` in the footer keeps truncation visible (bar caps at top-12 by design).
- Weakest link, named: occupancy `latest()` — see above; breakpoint and fix stated.

### E — Decision ownership
- **[E][Resolved]** the `Effect.promise`-vs-`DbError` inconsistency — decided and encoded this review (option "wire it", see fixes above).
- **[E][Owner decision needed] severity colors** — the PDF *prescribes* Warning=orange / Info=blue; the approved claude.ai/design mock (P8, deliberately) uses mono/gray with red reserved for Critical. Two user-approved sources conflict; grading is against the PDF. Colors are theme tokens (`--warn`, `--info` in `globals.css`), so spec-literal compliance is a token swap, no code change.
- **[E][Owner decision needed] occupancy fill hues** — PDF says "e.g. green/yellow/red" (soft); mock uses gray/green/red. Weaker claim than severity, but low-occupancy gray sits close to stale-gray, thinning the encoding. Also a pure `--occ-*` token swap (the code comment already says so).
- **[E][Minor]** `env.ts` validates lazily on first access with truthiness only — a deploy missing `AUTH_SECRET` boots and 500s on first login instead of failing fast; no min-length check. → Fix plan #6.
- Well-owned decisions, confirmed still true in code: whitelist-map raw-SQL guard; TABLE_META dual-purpose (meta payload + validation whitelist); `dbType` vs `isNumeric` split; StrictMode-off with production-build bisection evidence; `setLayout` stale-echo rejection invariant; globalThis-memoized ManagedRuntime (note: this makes service-layer edits invisible to dev hot-reload — restart `bun run dev` after touching `src/server/*`; discovered empirically this review).

### S — Proof / tests
- **[S][Major — deferred, owned]** no automated tests (unit tests are an explicit PDF *bonus*, deliberately deferred). The risk concentration is now larger post-fix: `validateConfig`/`validateGlobalFilters` carry seven rejection rules with zero regression protection; `session-token` sign/verify/tamper/expiry and the `TABLE_META ⊆ DB_COLUMN` invariant are likewise DB-free, high-value, cheap tests. → Fix plan #3.
- Evidence that does exist: the seed's exact row-count assertion; this review's reproducible curl probe suite (all inputs and expected statuses recorded above); browser verification transcripts per phase in PROMPT_HISTORY.md.
- **[S/client][Major — open]** a shape-corrupted-but-`version:1` localStorage value hydrates unvalidated (blind shallow merge) → first selector crash → **persistent crash loop**, and there is no `error.tsx`/`global-error.tsx` anywhere in the app; unparseable corruption is silently swallowed (dashboard lost, no notice). The import path decodes with `Schema.decodeUnknownSync(DashboardState)`; the hydration path — same data shape — doesn't. → Fix plan #2.

### Client boundary (verified well-handled — for the record)
Import validates against the contract schema and toasts on bad files; the date picker cannot emit the shapes the backend now 400s anyway; card states cover unconfigured/loading/error/empty with no crash path on empty rows; gauge math is divide-by-zero-safe (`max - min || 1`, clamped fractions). Residual minors: no import file-size cap or overwrite confirm, no retry button in the card error state, numeric filter inputs are still free-text client-side (the server 400 now surfaces in the card, so wrongness is visible — the client guard is UX polish). → Fix plan #5, #9, #10.

---

## Decision log (ownership)

- **Fix NaN/empty filter values server-side (not client-first):** the API is the trust boundary — a client guard can't protect direct callers, and the card error state now displays the server's constraint message. Trade-off: users can still *type* a bad value and learn at query time; at scale I'd add the client-side numeric input too (fix #5).
- **Reject invalid/reversed custom ranges instead of clamping:** silent correction hides caller bugs; a named 400 is honest. Trade-off: none meaningful — the shipped picker can't produce these shapes.
- **Wire `DbError` (vs. deleting it):** the http layer, contract, and error taxonomy were clearly built for it; wiring is six mechanical call sites and makes DB failure visible in signatures. Trade-off: one more error type in service signatures; the alternative (defects) hid a real failure mode behind `catchCause`.
- **`tryDb` logs the raw error, returns a generic message:** operators need the truth, clients must not get internals. At scale: structured logging with request correlation, not `console.error`.
- **Int-overflow filter values stay 500:** bounds-checking every numeric column against SQL type ranges buys little; the failure is typed, logged, non-leaking.
- **Severity/occupancy hues left as the approved mock:** deliberately *not* changed autonomously — the PDF and the user-approved design mock disagree, and that arbitration belongs to the owner. Both are single-token swaps.
- **No rate limiter added in this pass:** demo-scoped auth with a documented 128-bit production PIN; adding a limiter is fix #1 the moment this faces a network the author doesn't control.

## Fix plan (remaining, ordered)

1. **[I]** Per-IP fixed-window throttle on `POST /api/auth/login` (5/min → 429).
2. **[S/client]** Validate persisted state on hydration with the existing `DashboardState` decoder (custom `merge`, fall back to empty + toast) and add an app-level `error.tsx`.
3. **[S]** Vitest suite, DB-free: the seven validation rejections, session-token round-trip/tamper/expiry, `TABLE_META ⊆ DB_COLUMN` invariant.
4. **[V]** Occupancy `latest()` → windowed SQL (`ROW_NUMBER` per zone) or `take` bound; keep the breakpoint documented either way.
5. **[D/UX]** Numeric filter columns: `type="number"` input + block save on non-finite values (mirror the existing `gaugeRangeInvalid` pattern).
6. **[E]** Fail-fast env validation at startup; minimum `AUTH_SECRET` length.
7. **[D]** Content-Length cap on POST bodies.
8. **[D]** Gauge: require finite numbers and `min ≤ target ≤ max` at save time.
9. **[UX]** Import: file-size cap + confirm-overwrite when cards exist.
10. **[UX]** "Retry" button in the card error state.
11. **[Owner]** Decide severity + occupancy token hues: PDF-literal vs. approved mock.

---

*Fixed this review (uncommitted at time of writing): `apps/web/src/server/query.ts`
(validation + `tryDb`), `apps/web/src/server/prisma.ts` (`tryDb` helper),
`apps/web/src/server/occupancy.ts`, `apps/web/src/server/meta.ts` (`DbError`
wiring). Verified: `typecheck` + `lint` + production `build` clean; full live
probe suite green (rejections 400 with named constraints, happy paths
byte-identical, `DbError` path fires with server-side-only detail).*
