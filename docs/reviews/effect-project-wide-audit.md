# Effect code audit — project-wide (2026-07-17)

Verdict: **No blockers**   |   **2 minor** (carried over — **fixed
same-day**, see below) · **6 informational** (3 new; the 2 carried-over
ones **fixed same-day**) · **7 positives** (4 new, 3 re-verified)

Scope: every file importing from `effect` in the repo — 17 files, found
by grep and independently re-reproduced by both the audit agent and the
coordinator. This extends `docs/reviews/effect-language-service-setup-and-audit.md`
(which covered `packages/contract`, most of `apps/web/src/server`, and
most API routes) to the five surfaces that audit never explicitly read:

- `apps/web/src/components/dashboard/dashboard-header.tsx` — the repo's
  only client-side Effect usage
- `apps/web/src/server/clock.ts`, `meta.ts`, `occupancy.ts`
- `apps/web/src/server/query.test.ts`
- `apps/web/src/app/api/query/route.ts` (first explicit read)

Method: delegated to the `effect-setup-guide` agent (natively dispatched
this time — its `subagent_type` is registered now, unlike in the prior
audit) with an audit-only brief; the coordinator then independently
re-ran the diagnostics CLI (output reproduced byte-identical), re-read
every newly-cited file:line against live source, and re-checked the two
`effect`-package citations that new findings rest on
(`package.json:28`'s `"sideEffects": []`; zero occurrences of
`decodeUnknownEither` in `Schema.ts`). Nothing below is transcribed from
the agent's self-report without that second check.

## Diagnostics CLI (reproduced 2026-07-17)

```
$ apps/web/node_modules/.bin/effect-language-service diagnostics --project apps/web/tsconfig.json
Checked 84 files out of 84 files.
5 errors, 0 warnings and 13 messages.        (exit 1)

$ packages/contract/node_modules/.bin/effect-language-service diagnostics --project packages/contract/tsconfig.json
Checked 5 files out of 5 files.
0 errors, 0 warnings and 0 messages.         (exit 0)
```

Identical totals and identical sites to the prior audit (file count grew
81→84 from three new non-Effect client files: `sidebar-provider.tsx`,
`theme-toggle.tsx`, `ui/dropdown-menu.tsx`).

## Prior follow-ups: all four found still open at audit time — fixed same-day

At audit time all four were still open (CLI errors at
`query.ts:58,73,95,102,112`; messages at the identical 13 sites;
`auth.ts:20` uncommented; `login/route.ts:42` returning `{ message }`
only). All four were then applied on 2026-07-17:

| Follow-up | Status | Fix |
|---|---|---|
| `return` on 5 `missingReturnYieldStar` sites | **FIXED** | all 5 `validateConfig` failure branches now `return yield*` |
| 13× drop redundant `Effect.fail` wrapper | **FIXED** | `yield* new XError(...)` at all 13 sites (`query.ts` ×10, `login/route.ts`, `occupancy/latest/route.ts` ×2) |
| Comment on `auth.ts` explaining intentional `Date.now()` | **FIXED** | comment above `signSession` explaining the DEMO_NOW sign/verify desync risk |
| Login route `{error, message}` shape parity | **FIXED** | `catchTags`/`catchCause` branches carry `error: _tag` / `"InternalError"`; failure response now `{error, message}` matching `http.ts`, with a comment on why the route can't compose through `toResponse` |

Post-fix verification: `effect-language-service diagnostics` on
`apps/web` now reports **0 errors, 0 warnings and 0 messages** (exit 0;
was 5/0/13, exit 1); `bun run typecheck` and `bun run lint` clean;
`bun test src` 35/35 pass (117 expect calls), including the tests that
exercise the changed validation branches.

## Findings

### Minor (both known — **FIXED 2026-07-17**, see table above)

- **[Minor → fixed] `query.ts:58,73,95,102,112`** — `yield* Effect.fail(...)`
  without `return` on never-succeeding branches (`missingReturnYieldStar`).
- **[Minor → fixed] 13 sites** (`query.ts` ×10; `login/route.ts:20`;
  `occupancy/latest/route.ts:14,22`) — redundant `Effect.fail` around
  yieldable `Schema.TaggedErrorClass` errors
  (`unnecessaryFailYieldableError`). Five overlapped the finding above.

### Informational — new

- **[Info] `dashboard-header.tsx:62-75`** — the import path's bare
  `catch {}` toasts only "Invalid layout file", discarding the
  `SchemaIssue` that `decodeUnknownSync` attaches as the thrown error's
  `cause` (`node_modules/effect/src/SchemaParser.ts:537-556`). Nothing
  escapes and the input is reset before the async gap — defensively
  correct, just lossy UX for someone hand-editing an export: no hint
  which field was wrong. Not a bug; surface `error.cause` in dev or in
  the toast description if that UX ever matters.
- **[Info] `dashboard-header.tsx:15-17`** — the "no `*Either` in this v4
  beta" comment is accurate (grep of `Schema.ts` confirms: `…Sync`,
  `…Effect`, `…Option`, `…Result`, `…Promise`, `…Exit` exist;
  `decodeUnknownEither` does not), and the decoder is correctly built
  once at module scope. Checked and cleared one gotcha: `decodeUnknownSync`
  rethrows a wrapped `Cause` for async/defect decodes
  (`SchemaParser.ts:525-529`), but `DashboardState` is pure synchronous
  structs/literals, so that path is unreachable here.
- **[Info] client-bundle impact of importing `effect` in
  `dashboard-header.tsx` is bounded** — `effect@4.0.0-beta.98` declares
  `"sideEffects": []` (`node_modules/effect/package.json:28`, verified),
  so the Schema module graph tree-shakes; this is the repo's sole
  client-side `effect` import. Nothing warrants a dynamic import today.
- **[Info] `query.test.ts:72-85`** — the stub layer graph is rebuilt on
  every `execute()` call (`Effect.provide(layer)` per effect; layer
  memoization is per-run, keyed by reference in `Layer.ts:412-423`'s
  `MemoMapImpl`). Harmless — the graph is two `Layer.succeed` stubs plus
  a finalizer-free `Layer.effect`, and per-call rebuild is what keeps
  each harness's recorded `calls` isolated. Only worth revisiting if a
  real resource layer is ever substituted in.

### Informational — carried over

- **[Info → fixed] `login/route.ts:42`** error-shape divergence from
  `http.ts`'s `{error, message}` — fixed 2026-07-17 (see table above).
- **[Info] `http.ts:67,85`** two justified `any`s and the
  `handleJson`/`handleEffect` calling-convention asymmetry; cosmetic,
  left as-is.

### Positives — new

- **[Positive] `query.test.ts:92-104`** — expected failures run through
  `Effect.runPromise(Effect.flip(effect))`, so tests assert typed errors
  by `_tag` (narrowing before touching variant fields), and an unexpected
  *success* rejects the promise and fails the test loudly.
  `ManagedRuntime` is correctly absent — no resources to manage — and the
  production `runtime.ts` singleton is never imported, so tests cannot
  touch the real Prisma layer.
- **[Positive] `clock.ts:9-14`** — minimal `Context.Service` +
  `Layer.succeed` wrapper over `@bms/database`'s DEMO_NOW-aware `now()`,
  no error channel (correct: synchronous, infallible). Consumers are
  consistent: `QueryService` and `OccupancyService` inject it;
  `AuthService` deliberately doesn't (the prior audit's verified
  sign/verify clock-desync reasoning still holds).
- **[Positive] `meta.ts` / `occupancy.ts`** — textbook copies of the
  established pattern: `Context.Service` + `Layer.effect` +
  `Effect.fn`-named methods + `tryDb`, so declared interface error
  channels (`Effect<_, DbError>`) match exactly what the implementations
  produce. `occupancy.ts:54`'s staleness comparison uses the injected
  clock, so DEMO_NOW staleness demos work end-to-end.
- **[Positive] `api/query/route.ts:6-11`** — the cleanest route in the
  app: `handleJson(QueryRequest, …)` composes parse → decode → service
  call and inherits `http.ts`'s exhaustive `catchTags` + `catchCause`;
  the route file contains zero error handling to get wrong.

### Positives — carried over, re-verified

- **[Positive] Exactly one runtime/layer graph in production** —
  `ManagedRuntime.make` only at `runtime.ts:29`, memoized on
  `globalThis`; the only other layer graph is the test stub harness. The
  single-reference `infra` memoization (one Prisma pool, not four) still
  holds against `Layer.ts:412-423`.
- **[Positive] No swallowed defects at any run site** — `http.ts:52`'s
  `catchCause`, login route's `catchCause`, `tryDb`'s log-then-map, and
  test rejections all account for the defect channel; both production
  `runPromise` calls run effects typed `E = never`.
- **[Positive] `packages/contract` clean** — 0/0/0 from the CLI;
  `TaggedErrorClass` usage matches Effect's own documented pattern;
  v4 array-argument `Schema.Union([...])`/`Schema.Literals([...])` used
  consistently.

## Recommended follow-ups (none blocking)

The prior audit's four follow-ups were all applied same-day (see the
fix table above). Remaining optional items:

- If import-error UX ever matters, surface the decode failure's `cause`
  in `dashboard-header.tsx`'s catch instead of discarding it.
- `effect-language-service diagnostics` could be wired into CI (it now
  exits 0 on this tree), without adopting the invasive `patch` step.

## Files changed

The audit itself was read-only. The same-day follow-up fixes touched:

- `apps/web/src/server/query.ts` — 10 wrapper removals, 5 `return`s added
- `apps/web/src/app/api/auth/login/route.ts` — wrapper removal + `{error, message}` shape
- `apps/web/src/app/api/occupancy/latest/route.ts` — 2 wrapper removals
- `apps/web/src/server/auth.ts` — `Date.now()` intent comment
