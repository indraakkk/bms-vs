---
name: production-readiness-review
description: Run a production-readiness and ownership review on a completed code change before it is considered done. Use this AFTER implementing any feature, fix, or change, and after any adversarial or security pass, as the definition-of-done gate. Also use it whenever the user asks to "review", "harden", check if something is "production ready", prepare a PR or merge, or self-review AI-assisted code. It audits input validation, error honesty, security and isolation, behavior under scale and failure, decision ownership (the "why"), and test evidence, using the DRIVES framework. Trigger it proactively when wrapping up a change even if the user does not say the word "review", because unvalidated inputs, misleading errors, shallow scalability, and unexplained decisions are exactly what pass a local demo but fail production and code review.
---

# Production Readiness Review (DRIVES)

A change that works on the happy path is not done. It is a demo. This gate reviews the *unhappy* paths
and forces the author to own every decision. It exists because the things that fail real code review
and on-call, unvalidated inputs, dishonest errors, no reasoning about scale, and choices nobody can
justify, are invisible when you only click through the working flow.

Run this as the last step before calling a change complete, and treat its blockers as blocking.

## When to run, and how it relates to adversarial review

Run after implementation, before "done" / PR / merge. It pairs with adversarial review but is not the
same lens:

- **Adversarial review** takes the attacker's mindset: how do I break this, exploit it, or feed it
  something malicious?
- **This gate (DRIVES)** takes the owner's mindset: is this production-ready, and can I justify every
  decision in it?

Best practice: run the adversarial pass first to surface breaks, then run DRIVES to certify the fixes
hold, the inputs are bounded, the errors are honest, it behaves under load, and every decision is owned.
Findings from both feed one fix plan.

## Scope the review to the change

Look at what actually changed: `git diff` against the base branch, or the files touched in this task,
plus their immediate blast radius (callers, the data they write, the endpoints they expose). Review the
change and what it can affect, not the whole repository. A focused, concrete review beats a broad, vague
one.

## Stance: adversarial then constructive

Assume it is broken. Actually try to break it, on paper: enumerate specific bad inputs and trace what
happens, name a specific concurrent interleaving, name a specific scale breakpoint. Then for each issue,
either fix it or *consciously accept it with a written reason*. A hand-wave is not a finding. "finishTime
is not validated" is weak; "finishTime accepts -5 and 10^12, and -5 reaches the formatter and throws a
500" is a finding.

---

## DRIVES: the six dimensions

For each dimension, check the listed things, and understand *why* it matters so you can judge borderline
cases rather than pattern-match.

### D — Define the input contract
Every input that crosses a boundary needs an explicit, enforced contract. Inputs include: request body
fields, query params, path params, headers, uploaded files, env/config values, and **responses from
external APIs** (never trust those either). For each input, pin down: type; required vs optional; numeric
bounds (min/max) and integer-vs-float; string min/max length; date/time validity and a sane range (no
negative durations, no year 9999); enum / allowed set; format (regex, id shape, email). Enforce it at the
boundary with a schema or validator, *before* business logic runs.

*Why:* a field that "accepts arbitrary values" is a bug even when the demo works. Unvalidated input is
the single most common production-readiness tell, and the first thing a reviewer probes.

### R — Reject wrong, honestly
Trace each invalid input to the response it produces. It must return a **client error (400/422)** with a
**specific message that names the violated constraint** (for example, "finishTime must be between 0 and
86400 seconds"), not a generic 500, and not a leaked stack trace or SQL error. The message must match the
real cause, no misleading errors. Keep client errors (4xx) and server errors (5xx) distinct.

*Why:* showing a server error for a validation limit, or a vague message, tells a reviewer the boundary
was not handled. Honest, specific, correctly-classified errors are a core production signal.

### I — Isolate and secure
AuthN and AuthZ on every protected route. Per-user or per-tenant data isolation: every read and write is
scoped to the owner; ownership is checked; return 404 rather than 403 where confirming existence would
leak information. Parameterized queries only, never string-built SQL; never eval or exec user input.
Secrets are not logged and not returned in responses. Abuse-prone endpoints (auth, email/SMS sends,
expensive operations) are rate-limited.

*Why:* isolation and injection are non-negotiable in production and rarely exercised by a demo, so
reviewers test them first. A cross-tenant read or an injectable query is an automatic fail.

### V — Verify under scale and failure
Concurrency: find the races; are shared mutations atomic (guard in the write, not read-then-write); are
retriable operations idempotent. Scale: what breaks at 10x, 100x, 1000x, unbounded result sets (needs
pagination or a hard limit), N+1 queries, missing indexes on filtered columns, memory that grows with
input, connection-pool exhaustion, per-request work that should be batched or queued. External
dependencies: timeouts, retries (transient errors only), failover, and what happens when they are down.
Name the single weakest link, the concrete breakpoint, and the specific change you would make, and state
what you are deliberately deferring and why.

*Why:* "it scales" is not an answer. Production depth is naming the breakpoint and the fix, and being
explicit about the trade-offs you chose to defer.

### E — Explain every decision (ownership)
For each non-trivial choice in the change, a boundary, a data model, a pattern, a library, a trade-off,
state the *why* in one or two sentences, the trade-off accepted, and what you would change at larger
scale. Any choice you cannot justify is itself a finding: mark it "unowned decision, must understand or
change." Capture these in a short decision log.

*Why:* reasoning and ownership cannot be outsourced to a tool. Being able to say why the code is
structured the way it is is what separates an owner from an assembler, and it is the first thing both an
interviewer and an on-call engineer test. This dimension is the reason this skill exists.

### S — Show the proof
For each risky path, the validation rejections, the concurrency guard, each failure state, the isolation
boundary, is there a test or a reproducible check proving it both succeeds and fails correctly? A risky
path with no evidence is a finding. Prefer a script or automated test over eyeballing.

*Why:* an untested boundary is an assumption. Proof is what lets you claim it works when someone pushes.

---

## Severity

- **Blocker (do not ship):** a security or isolation hole; a data-corruption risk; unvalidated input that
  reaches storage or an external call; a 500 returned for a normal invalid input; or an unowned decision
  central to the change.
- **Major:** a field missing bounds; a misleading or misclassified error; a clear scale cliff on a likely
  hot path; a missing test on a risky path.
- **Minor:** message wording; a non-hot-path inefficiency; nice-to-have hardening.

---

## Workflow

1. **Scope** the change (`git diff` / touched files + blast radius).
2. **Run DRIVES**, enumerating concretely. For D and R, list the actual bad values you tried and what
   happened. For V, name the actual race and the actual breakpoint. No vague findings.
3. **Record findings** as `[dimension][severity] file:line — concrete problem → recommended fix`.
4. **Give a verdict:** Ship, Fix first, or Not ready, with the blocker list up top.
5. **Fix loop:** apply the fixes (or propose them if not in an agentic flow), then re-verify, re-run the
   tests/checks and re-review the changed spots. Do not close the review with open blockers.
6. **Write the report** to `docs/reviews/<change-name>.md` (create the dir if needed) so reviews and the
   decision log accumulate as ownership evidence over time.

## Report format

ALWAYS use this structure:

```
# Production Readiness Review — <scope>
Verdict: Ship | Fix first | Not ready   |   Blockers: <n>

## Blockers (must fix before done)
- [D][Blocker] <file:line> — <concrete problem> → <fix>

## Findings by dimension
### D — Input contracts
- [D][Major] <file:line> — <problem> → <fix>
### R — Error honesty
### I — Isolation & security
### V — Scale & failure
### E — Decision ownership
### S — Proof / tests

## Decision log (ownership)
- <decision>: why <one line>; trade-off <one line>; at scale I'd <one line>

## Fix plan
1. <ordered, concrete fixes>
```

## Examples (the bar to hit)

**Example 1 (D + R):**
Input tried: `finishTime` = -5 and = 999999999 on POST /badges.
Finding: `[D][Blocker] api/badges POST — finishTime accepts arbitrary values (negative, absurdly large); no bounds at the boundary.` and `[R][Major] an out-of-range finishTime surfaces as a 500 from the time formatter, not a 422.`
Fix: constrain `finishTime` to an integer in [0, 86400] in the request schema; return `422 "finishTime must be between 0 and 86400 seconds (24h)"`.

**Example 2 (D):**
Input tried: a 10,000-character `raceName`.
Finding: `[D][Major] raceName has no max length; a 10k-char value is accepted, breaks the badge layout, and bloats storage.`
Fix: `raceName` is a string with min length 1 and max length 60, enforced at the boundary; `422` on violation.

**Example 3 (E):**
Finding: `[E][Blocker] the generation retry retries every error, but there is no stated reason it is safe to retry a timeout the same as a transient blip.` An unowned decision is not done.
Fix: articulate and encode the rule, retry transient errors only, never a validation error or a timeout, and write the one-line why in the decision log.

## Anti-patterns to catch (and why they matter)

- **Happy-path bias:** a passing demo proves nothing about production. The review's whole job is the
  unhappy paths.
- **"It worked, so it's validated":** accepting valid input is not the same as rejecting bad input. They
  are different code paths.
- **500 for a client mistake:** a validation failure is the client's error (4xx) with a clear message,
  never a server error.
- **Misleading messages:** the error must name the real cause and the violated constraint.
- **Unbounded fields:** every numeric, time, date, and string field needs explicit bounds. "No one would
  send that" is not a control.
- **Scale hand-waving:** "it scales" without a named breakpoint and a named change does not count.
- **Unexplained structure:** if the author cannot say *why* the code is shaped this way, that is the
  highest-priority finding, not a footnote.
