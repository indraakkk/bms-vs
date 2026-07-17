# Effect Language Service setup + Effect code audit

Verdict: **No blockers**   |   **2 minor** (mechanical, 13 sites) · **3 informational** · **5 positives independently verified**

Scope: install the Effect Language Service (`apps/web`, `packages/contract` —
`packages/database` has no Effect usage) and audit the existing Effect
usage in `packages/contract/src/**`, `apps/web/src/server/**`,
`apps/web/src/app/api/**`, and `apps/web/src/proxy.ts`. Method: delegated
to a fresh agent instructed to follow `.claude/agents/effect-setup-guide.md`
as its operating spec (that file's native `subagent_type` hadn't
registered yet this session, so it ran via explicit instruction to read
the file rather than native dispatch — functionally equivalent). Every
concretely-checkable claim in its report was then independently
reproduced by the coordinator — the diagnostics CLI re-run, the unit
suite re-run, every cited file:line re-read against live source, two
`effect` package source citations spot-checked — before being written up
here. Nothing below is transcribed from the agent's self-report without a
second, independent check.

Effect usage across `packages/contract` and `apps/web/src/server`/`app/api`
is correct and idiomatic, including in the areas that most commonly go
wrong under a v4 beta: scoped-resource release, layer memoization, and
typed-error-to-HTTP mapping. Everything found below is idiom-polish or a
latent (currently non-breaking) inconsistency — nothing rises to a
runtime bug.

---

## Part 1 — Effect Language Service install

Installed `@effect/language-service@0.87.0`, pinned exact (no
caret/tilde, per this repo's own pin-exact policy for `effect`), as a
devDependency in `apps/web` and `packages/contract` only —
`packages/database` has no Effect usage and was correctly left alone.
tsconfig `plugins` wired into both packages' `tsconfig.json`
(`@effect/language-service` appended *after* `next` in `apps/web`'s
plugin list, per the package's own README: it should load last); a
`$schema` pointing at the package's own `schema.json` added to both.
`CLAUDE.md`/`AGENTS.md` untouched and no external `~/.local/share` clone
performed — both correctly out of scope for "install the language
service."

**Path taken**: `effect-solutions` (the CLI the agent file's generic
checklist is built around) turned out to be a real, resolvable package
(v0.5.3) — not a hypothetical, which had been flagged as a live risk
going in. Its default recommendation (a single root-level tsconfig)
doesn't fit this repo's per-package tsconfig layout, so installation
went per-package instead, per this task's explicit repo-specific
override.

**The editor-only-plugin nuance, verified two ways.** TypeScript's
`compilerOptions.plugins` mechanism loads only inside editors/tsserver,
never during `tsc` CLI compilation — confirmed both by the package's own
README and empirically: `bun run typecheck`/`lint`/`build` are all clean
post-install with zero new output, exactly as expected, since the plugin
cannot affect `tsc` CLI output at all. **"Typecheck is clean" says
nothing about Effect-specific issues.** The package does ship a genuine
headless CLI, independent of both the editor-only plugin path and the
separate, more invasive `patch` mechanism (which monkeypatches
`node_modules/typescript` so `tsc`'s own exit code reflects Effect
diagnostics). Reproduced directly, from repo root:

```
$ apps/web/node_modules/.bin/effect-language-service diagnostics --project apps/web/tsconfig.json
Checked 81 files out of 81 files.
5 errors, 0 warnings and 13 messages.

$ packages/contract/node_modules/.bin/effect-language-service diagnostics --project packages/contract/tsconfig.json
Checked 5 files out of 5 files.
0 errors, 0 warnings and 0 messages.
```

All 18 `apps/web` findings feed directly into Part 2 below.

**Deliberately not done**: `effect-language-service patch` and its
accompanying `"prepare"` script (confirmed absent from every
`package.json`). This monorepo's `typescript` install is hoisted to one
shared root `node_modules/.bun/typescript@5.9.3`, symlinked into all
three packages including `packages/database` — patching it would
silently affect the Prisma-only package that's supposed to stay
untouched, and would change whether `bun run typecheck` exits non-zero
(`ignoreEffectErrorsInTscExitCode` defaults to `false`), corrupting the
clean baseline this task needed to verify against. That's a persistent,
repo-wide build-lifecycle change beyond what "install the language
service" was authorized to include. Left as a deliberate opt-in for
later — see Recommended follow-ups.

**Independently confirmed clean**: `bun run typecheck`, `bun run lint`,
`bun run build` from repo root — all tasks successful, zero errors, run
by the coordinator after the install, not just reported by the agent.

---

## Part 2 — Effect code audit

### Minor (mechanical, safe to batch-fix)

- **[Minor] `apps/web/src/server/query.ts:58,73,95,102,112`** — five of
  `validateConfig`'s ten failure branches `yield* Effect.fail(...)`
  without a leading `return`, while the other five in the same file
  (lines 26, 40, 129, 141, 148) use `return yield* Effect.fail(...)`.
  Reproduced via `effect-language-service diagnostics`, which flags
  exactly these 5 lines as `missingReturnYieldStar` errors, and via
  direct source read. Runtime behavior is identical either way — Effect's
  generator driver halts the enclosing `Effect.gen` the instant a failing
  effect is yielded, `return` or not — confirmed by re-running
  `bun test src/server/query.test.ts` (23/23 pass, including the three
  tests that specifically exercise these branches). The gap is static,
  not behavioral: without `return`, a future edit appending code after
  one of these `if` blocks would compile as though that code were
  reachable in the failure case, when structurally it never is. The tool
  offers a quick-fix for all 5 at once.

- **[Minor] 13 sites** (`query.ts` ×10 — lines 26, 40, 58, 73, 95, 102,
  112, 129, 141, 148; `app/api/auth/login/route.ts:20`;
  `app/api/occupancy/latest/route.ts:14,22`) — `yield* Effect.fail(new
  XError(...))` where the idiomatic v4 form is `yield* new XError(...)`
  directly. Confirmed against Effect's own source
  (`node_modules/effect/src/Schema.ts:13299`): `Schema.TaggedErrorClass`'s
  own doc example is `yield* new NotFound({ id: 42 })` with no
  `Effect.fail` wrapper — these error classes implement the Yieldable
  protocol directly, so the wrapper is redundant, not incorrect. Zero
  behavior difference; a codebase-wide style consistency cleanup,
  mechanical to batch-apply. Five of these 13
  (`query.ts:58,73,95,102,112`) are the same lines as the
  `missingReturnYieldStar` finding above — those five need both fixes
  (add `return`, drop the `Effect.fail` wrapper); the other eight need
  only the wrapper dropped. 13 distinct locations, 18 total diagnostic
  entries (13 messages + 5 overlapping errors) — matching Part 1's
  reproduced `5 errors, 0 warnings and 13 messages` output exactly.

### Informational

- **[Info] `apps/web/src/app/api/auth/login/route.ts:28-31,42`** —
  error-response shape diverges from every other route. Every other
  route composes through `http.ts`'s shared `toResponse`, whose
  `catchTags` block always includes `error: error._tag` alongside
  `message` (confirmed at `http.ts:28,36,45,49`). Login's `POST`
  hand-rolls its own `Effect.catchTags` — necessary because it must set
  an httpOnly cookie *after* a successful result, which `toResponse`'s
  immediate-Response finalization has no hook for — and its failure
  branch returns `Response.json({ message }, { status })`, dropping the
  `error` field. Confirmed non-breaking today: `login-form.tsx:56` reads
  only `body.message ?? "Invalid PIN"`, never `body.error`. Worth noting
  `proxy.ts`'s own 401 response (`proxy.ts:25`) *does* use the
  `{error, message}` shape — of the three places in this codebase that
  hand-construct an auth-related JSON error, login's route is the one
  outlier. Real, latent inconsistency, not an active bug. A fix would
  give `toResponse`/`handleJson` an optional post-success hook, or at
  minimum copy `toResponse`'s exact shape here.

- **[Info] The "one intentional `any`" inventory undercounts by one.**
  `CLAUDE.md` documents a single explicit `any` at `query.ts`'s
  `delegate()` (runtime-selected Prisma-model-delegate dispatch).
  `http.ts` has two more, both narrow and comment-justified: `handleJson<S
  extends Schema.Schema<any>, A>` (`http.ts:67`, with an
  `eslint-disable-next-line` explaining the generic-variance reason) and
  an `as Effect.Effect<A, ApiError, AppServices>` cast (`http.ts:85`,
  commented: contract schemas never use custom `DecodingServices`, so the
  cast narrows what TS can't see through generically). Confirmed by
  direct read — both are exactly the kind of narrow, explained escape
  hatch the rest of the codebase already does well. Flagging only so the
  `any`-inventory in project docs is precise, not because either is a
  gap.

- **[Info] `http.ts:67-94`** — `handleJson` and `handleEffect` have
  asymmetric calling conventions. `handleJson` returns `(request) =>
  Promise<Response>` (used directly as `export const POST =
  handleJson(...)`); `handleEffect` returns a bare `Promise<Response>`,
  so every GET route wraps it itself (confirmed at
  `app/api/meta/route.ts` and `app/api/occupancy/latest/route.ts`:
  `export async function GET() { return handleEffect(...) }`). Both are
  correct at every current call site — a minor API-surface inconsistency
  worth normalizing only if either helper is touched again, not a bug.

### Positives worth stating explicitly

- **[Positive] `apps/web/src/server/prisma.ts:9-17`** — `Layer.effect` +
  `Effect.acquireRelease` correctly replaces the nonexistent
  `Layer.scoped`. `CLAUDE.md` documents this as a deliberate v4-beta
  substitution; independently confirmed it's not just a workaround but
  correct: `node_modules/effect/src/Layer.ts:1277`'s `effect` combinator
  JSDoc states "The Effect is executed in the scope of the layer,
  allowing for proper resource management" — any `Scope` requirement
  `acquireRelease` introduces is discharged against the layer's own build
  scope, not leaked to callers. `$disconnect()` genuinely fires when
  `ManagedRuntime.dispose()` closes that scope. No resource leak.

- **[Positive] `apps/web/src/server/runtime.ts:9-17`** — no duplicate
  service construction across the layer graph. The `infra` layer
  (`PrismaService.layer` + `ClockService.layer`) is built once as a
  module-level `const` and the *same reference* reused 4 times — directly
  in `AppLayer` and via `Layer.provide(infra)` for
  `QueryService`/`MetaService`/`OccupancyService` (confirmed by direct
  read). Cross-checked against `Layer.ts:412-423`'s `MemoMapImpl`
  (`readonly map = new Map<Layer<any,any,any>, MemoMapEntry>()`) — layer
  construction is memoized by the `Layer` object's own reference
  identity, so reusing the same `infra` value (rather than building an
  equivalent-but-distinct one) is exactly what makes the memoization
  apply: one Prisma connection pool shared across every consumer, not
  four. The textbook fix for Effect's "layer diamond" duplicate-
  instantiation problem, applied correctly.

- **[Positive] `apps/web/src/server/http.ts:19-63`** — exhaustive, honest
  error mapping with a real defect safety net. `catchTags` exhaustively
  covers all four `ApiError` members (`ValidationError`→400,
  `UnknownColumnError`→400, `UnauthorizedError`→401, `DbError`→500) with
  client-actionable detail; a trailing `catchCause` (line 52) logs the
  full cause server-side and returns only a generic 500 message for
  everything else — defects, interruptions, or (confirmed via
  `env.ts:1-7`) a thrown plain `Error` from missing config, which becomes
  a defect inside `Effect.sync` and is correctly swallowed here instead
  of leaking. No internal detail leaks to the client at any layer.

- **[Positive] `apps/web/src/server/auth.ts:20`** — `Date.now()` instead
  of `ClockService` is correct, not an oversight. At first read this
  looks like it should use `ClockService` (as `QueryService`/
  `OccupancyService` do, to respect `DEMO_NOW`). Confirmed it's actually
  required: `verifySessionToken` (`session-token.ts:42`) also uses raw
  `Date.now()` and is deliberately Effect-free, because `proxy.ts`
  (confirmed at `proxy.ts:3,20` — no Effect import, no `ClockService`, no
  `ManagedRuntime`) calls it directly on every request including
  prefetches and is architecturally barred from depending on the Effect
  runtime at all. If `signSession` alone switched to `ClockService`,
  sign-time and verify-time clocks would desync the instant `DEMO_NOW` is
  set, breaking login specifically in demo mode. Correct as-is — see
  Recommended follow-ups for a documentation-only suggestion.

- **[Positive] `packages/contract/src/*`** — clean. 0 errors/warnings/
  messages from `effect-language-service diagnostics` across all 5 files
  (independently reproduced above). `errors.ts`'s four
  `Schema.TaggedErrorClass` definitions match Effect's own documented
  pattern exactly; `TABLE_META`/`CardConfig` are plain, well-commented
  Schema modeling with no service-composition concerns.

### Not re-litigated

A prior production-readiness review (`docs/reviews/p0-p7-required-scope.md`)
already covered input-validation/security in depth, including
`query.ts`'s filter-coercion and time-range validation. This audit is
scoped to Effect-idiom correctness and deliberately doesn't re-run that
pass. `buildWhere`'s per-card-filter-can-overwrite-the-global-filter
behavior is plain object-merge logic, not an Effect pattern — noted only
as a pointer to that existing coverage.

---

## Recommended follow-ups (none blocking)

> **Status update (2026-07-17)**: the first four items below were applied
> during the project-wide follow-up audit — see
> `effect-project-wide-audit.md` for verification (diagnostics now
> 0 errors / 0 warnings / 0 messages, typecheck/lint clean, 35/35 tests
> pass). Only the CI-wiring suggestion remains open as an opt-in.

- ~~Add `return` to the 5 `missingReturnYieldStar` sites in `query.ts`~~
  **FIXED** — all 5 sites now `return yield*`.
- ~~Batch-replace `yield* Effect.fail(new X(...))` → `yield* new X(...)`
  across the 13 flagged sites~~ **FIXED** — all 13 sites unwrapped.
- ~~One-line comment on `auth.ts:20` explaining why `Date.now()` — not
  `ClockService` — is intentional there~~ **FIXED** — comment added
  above `signSession` in `auth.ts`.
- ~~Login's error shape diverging from `toResponse`~~ **FIXED** — login's
  `catchTags`/`catchCause` branches now carry `error: _tag` (and
  `"InternalError"` for defects), and the failure response returns
  `{error, message}` matching `http.ts`, with a comment explaining why
  the route can't compose through `toResponse` (cookie-set on success).
- `effect-language-service diagnostics --project <tsconfig>` is now
  available for ad hoc use, or could be wired into CI, without adopting
  the more invasive `patch` step. (Still open — deliberate opt-in.)

## Files changed (Part 1 only — Part 2 was read-only)

- `apps/web/package.json`, `apps/web/tsconfig.json`
- `packages/contract/package.json`, `packages/contract/tsconfig.json`
- `bun.lock`
