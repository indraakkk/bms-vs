# AGENTS.md

This app runs Next.js **16.2.10**, not whatever version is most familiar
from training data. Next 16 changed App Router and route handler APIs in
ways that look plausible but are wrong if you write them from memory —
most commonly around the shape of dynamic route params and route handler
context, which are `Promise`-based in this version (`params` must be
`await`ed), and Turbopack-specific bundling behavior for workspace
package imports (see the root `CLAUDE.md` note about extensionless
imports in `packages/*/src`, which applies the same way here).

Before writing or editing anything under `src/app/` — pages, layouts,
route handlers, `loading`/`error`/`not-found` files — read the relevant
page(s) under `node_modules/next/dist/docs/01-app/` first. Don't rely on
pretrained knowledge of the App Router for this project.
