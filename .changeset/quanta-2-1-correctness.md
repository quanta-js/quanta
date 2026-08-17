---
'@quantajs/core': minor
'@quantajs/react': minor
---

Correctness, security and packaging pass.

**Packaging (breaking for anyone importing internals)**

- `@quantajs/core` now emits ESM + CJS instead of ESM + UMD. `require('@quantajs/core')` previously returned an empty object and
  silently wrote every export onto `globalThis.QuantaJS`; it now returns the real module.
- `@quantajs/react` ships real TypeScript declarations. It previously published `export { }` as its entire type surface.
- `@quantajs/react` no longer bundles Preact or the DevTools UI: 86.9 kB → 7.3 kB raw (20.1 kB → 2.9 kB gzip). `@quantajs/devtools`
  is now an optional peer, loaded through a dynamic import by `<QuantaDevTools />`.
- `'use client'` is preserved in the React build for Next.js App Router.

**Security**

- Prototype-pollution guards on every path where external data enters state (persistence, cross-tab sync, migrations, transforms).
- DevTools is opt-in via `enableDevTools()` and no longer attaches to `window` until enabled. Adds a `redact` option for state paths
  and action arguments. It previously stayed enabled in any build where `process.env.NODE_ENV` was not statically replaced.
- Cross-tab sync validates `storageArea`, contains parse failures, and refuses payloads from a newer schema version.
- A throwing DevTools listener can no longer break application state writes.

**Reactivity**

- Deep/bubbled triggers now route through the same batching and scheduler path as direct ones, so `batchEffects()` applies to nested
  state and computeds fed by nested state invalidate correctly.
- Adding a property invalidates `Object.keys` / `for...in` / spread dependents.
- Parent links are pruned on reassignment and delete, removing phantom invalidations and a memory retention path.
- Array mutators trigger once per call instead of three times.
- `batchEffects()` returns its callback's value.

**Store**

- Getters now take priority over shadowed state on the flat store, matching the warning that was already emitted.
- `$reset()` runs as a single batch.
- New: `getOrCreateStore()` (HMR/StrictMode-safe), `destroyAllStores()`, and an awaitable `store.$hydrated`.

**React**

- `useQuantaSelector` tracks what the selector reads instead of comparing its result. `s => s.todos` now re-renders on in-place
  mutation, and a component is not re-rendered for state it never reads. Adds `equalityFn` and a `shallow` comparator.
- `useComputed` survives a StrictMode remount.
- Inline selectors no longer cause a resubscribe on every render.

**New exports:** `toRaw`, `markRaw`, `readonly`, `shallowReactive`, `shallowReadonly`, `untrack`, `effect`, `effectScope`,
`nextTick`, `isProxy`, `isReadonly`, `sanitizePayload`, `safeJsonParse`.
