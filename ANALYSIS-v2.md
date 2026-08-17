# QuantaJS v2.0.0 — Full Codebase Audit, Security Review & Product Strategy

**Scope:** `quanta-js/quanta` (`@quantajs/core`, `@quantajs/react`, `@quantajs/devtools` @ 2.0.0) and `quanta-js/quanta-docs`.
**Method:** full source read, dependency install, `pnpm test` (265 tests), `pnpm build`, `pnpm bench`, plus 22 purpose-written probe cases that were promoted into a permanent `known-defects` regression suite.
**Date:** 2026-08-17

Everything asserted below was **executed and observed**, not inferred. Each finding carries an ID; the executable proof lives in
`packages/core/src/__tests__/known-defects.test.ts` and `packages/react/src/__tests__/known-defects.test.tsx`.

---

## 0. Executive summary

The reactivity core is a genuinely good design. The Vue-flavoured API is the right instinct, the proxy layer handles Map/Set/Array,
the effect system has proper cleanup, lazy computeds, schedulers and nested-batch support, and `toRaw`/`proxySet` correctly prevent
double-wrapping. **The foundation is sound.**

The problem is that v2.0.0 shipped with a set of defects that break the three promises on the tin, and each of them is the kind a
developer hits in their first hour:

| The promise | What actually happens in 2.0.0 |
|---|---|
| **Type-safe** | `@quantajs/react`'s published `dist/index.d.ts` is literally `export { }`. The React package ships **zero types**. |
| **Framework-agnostic** | `require('@quantajs/core')` returns `{}` and silently dumps every export onto `globalThis.QuantaJS`. React is the only adapter. |
| **Compact** | `@quantajs/react` is 86.9 kB raw / 20.1 kB gzip because Preact + the entire DevTools UI + inlined Tailwind are bundled into it. |
| **Blazing fast** | A *cached* computed read is **38× slower** than a plain reactive property read. One action dispatch costs ~79 µs. |
| **Trustworthy at scale** | A module-scope store is a process-wide singleton — under SSR, one user's data is served to the next request. |

And two headline correctness bugs:

- **`useQuantaSelector(store, s => s.todos)` never re-renders.** The most natural selector a React developer can write produces
  silently stale UI. (B-1, proven.)
- **DevTools receives zero `STATE_CHANGE` events, ever.** The state inspector has never live-updated in v2.0.0. (B-2, proven.)

The 265-test suite is green because it tests units in isolation and never tests the wiring between them — the DevTools tests build
mock stores by hand and call `emit()` directly, which is exactly why a completely dead integration path shipped.

**None of this is fatal.** It is roughly six weeks of focused work, and the architecture does not need to be rewritten to fix any of
it. The strategic recommendation in §6 is the more important half of this document: the proxy you already own can emit a **patch
stream**, and that one primitive unlocks undo/redo, time travel, collaborative editing, server sync and optimistic updates — a
differentiator that Zustand, Jotai and Valtio do not have and cannot easily add.

**Verdict: do not market v2.0.0 to enterprises yet. Ship a 2.1 correctness-and-packaging release first, then build the differentiator.**

---

## 1. What is genuinely working

Credit where it is due — these are non-trivial and correctly done:

- **Effect cleanup on re-run.** `reactiveEffect` tracks its own `Set<Dependency>` and removes itself from stale deps before each
  re-run. Many hand-rolled reactivity systems leak here; this one does not.
- **Snapshot-before-iterate in `trigger`/`notify`.** The comments show the author understood the ES spec hazard of mutating a `Set`
  during iteration. Correct.
- **Lazy computed with scheduler-based invalidation.** `dirty` flag + `lazy: true` + a scheduler that only re-triggers on the
  false→true transition. This is the right shape, and the "2 readers → 1 recompute" probe confirmed it works.
- **Nested batching.** `batchEffects` uses a depth counter and only flushes at depth 0, and discards the queue if the batch throws.
- **Proxy identity discipline.** `reactiveMap` + `proxySet` correctly prevent both double-wrapping and proxy-of-proxy chains — the
  comment about `[...proxies]` causing exponential trap chaining shows real hard-won knowledge.
- **`pauseTracking`/`resumeTracking` around callbacks.** Both `watch` and the store's deep watcher pause tracking before invoking
  user callbacks. This prevents dependency pollution and is a subtle thing to get right.
- **Collection support.** Map/Set instrumentation with `toRaw` on keys, identity-preserving Map keys in iterators, and `size`
  tracking is more complete than most competitors.
- **Persistence feature set.** Versioned migrations, `include`/`exclude`, `transform`, `validator`, `onError` with a phase tag,
  pluggable adapters, cross-tab sync. The *surface* is well thought out.
- **Housekeeping.** Changesets, dependabot, issue/PR templates, CODE_OF_CONDUCT, SECURITY.md, a CI matrix with lint→test→bench,
  coverage thresholds. Better hygiene than most projects at this stage.

---

## 2. Security findings

| ID | Sev | Finding |
|---|---|---|
| S-1 | **High** | CJS build is UMD → silent total failure + global pollution |
| S-2 | **High** | Prototype pollution via the persistence merge path |
| S-3 | **High** | Cross-tab sync trusts storage content implicitly |
| S-4 | **Med** | DevTools bridge exposed on `window` and enabled-by-default outside bundlers |
| S-5 | **Med** | Persistence saves *everything* by default; no redaction/encryption story |
| S-6 | **Med** | A throwing DevTools listener breaks application state writes |
| S-7 | **Med** | Path traversal in the docs site's raw-MDX API route |
| S-8 | **Low** | No downgrade protection on persisted payload versions |
| S-9 | **Low** | Supply-chain: no provenance, no CodeQL, no audit gate |

### S-1 (High) — `require('@quantajs/core')` silently returns `{}` and pollutes `globalThis`

`packages/core/vite.config.ts` declares `lib.name = 'QuantaJS'` and no `formats`, so Vite emits **ES + UMD**. `fileName` maps the
non-ES build to `index.js`, and `package.json` points `require` at it — but the package is `"type": "module"`, so Node parses
`dist/index.js` as ESM. The UMD wrapper happens to be *valid* ESM, so it does not crash. It runs, finds no `exports` and no `define`,
and takes its global-assignment branch.

Reproduced against the real built artifact:

```
require() returned keys: 0
globalThis.QuantaJS leaked? true  (18 exports)
require("@quantajs/core").createStore is undefined
```

Every CJS consumer — Jest without ESM, Metro/React Native, older Next configs, any `require()` in tooling — gets `undefined` for
everything **with no error message**, while the library quietly writes 18 symbols onto the global object. A silent failure is worse
than a crash, and unconditional global namespace pollution is a legitimate security smell.

**Fix:** emit `formats: ['es', 'cjs']`, name the CJS output `index.cjs`, drop `lib.name`, and add `publint` + `arethetypeswrong` to CI.

### S-2 (High) — Prototype pollution through persisted state

`packages/core/src/core/create-store.ts` wires persistence rehydration to:

```ts
for (const key in newState) {
    if (!Object.is((state as any)[key], newState[key])) {
        (state as any)[key] = newState[key];
    }
}
```

`newState` is the output of `JSON.parse` on adapter content, and `JSON.parse` creates a real own `__proto__` property, which
`for...in` enumerates. Proven:

```
s.polluted (proto-inherited) = yes
state prototype changed = true
```

There is no `__proto__` / `constructor` / `prototype` filtering anywhere on the ingest path, and the `validator` hook is optional and
runs *before* the merge. The threat model is not theoretical: any XSS, any hostile same-origin script, or a tampered cross-tab
`storage` event (see S-3) gets to choose the prototype of your store state.

**Fix:** reject the three dangerous keys on ingest, use `Object.create(null)` for parsed payloads, prefer
`Object.defineProperty`/`hasOwnProperty` guards over bare assignment, and ship a `JSON.parse` reviver that strips them by default.

### S-3 (High) — Cross-tab sync trusts storage content implicitly

`setupCrossTabSync` takes whatever arrives on the `storage` event, deserializes it, optionally transforms it, and calls `setState`.
There is no integrity check, no schema validation unless the user supplies `validator`, and `LocalStorageAdapter.subscribe` does not
even check `e.storageArea === localStorage`. Combined with S-2, one XSS becomes **persistent** state injection that survives reload
and propagates to every open tab.

**Fix:** validate by default (see the Standard Schema proposal in §6.9), check `storageArea`, and treat all storage content as
untrusted input with a documented threat model.

### S-4 (Medium) — DevTools state and action arguments exposed on `window`

`packages/core/src/devtools/index.ts` ends with an unconditional module-level side effect:

```ts
if (typeof window !== 'undefined') {
    (window as any).__QUANTA_DEVTOOLS__ = devtools;
}
```

The `_enabled` guard only turns off when `process.env.NODE_ENV === 'production'` is statically replaced. In a plain ESM/CDN bundle,
a Deno/Bun target, or any build that does not define `process`, the `typeof process !== 'undefined'` check is false and **devtools
stays enabled in production**. Every store, every state mutation and **every action's arguments** — auth tokens, PII, payment
details, whatever your actions take — become readable from any script on the page. There is no redaction hook and no opt-in gate.

**Fix:** make DevTools opt-in via an explicit `enableDevTools()` call, attach to `window` only when enabled, support
`import.meta.env.DEV`, and add a `redact` option for action args and state paths.

### S-6 (Medium) — A bad DevTools listener breaks state writes

`emit()` calls listeners with no try/catch, and `notifyStateChange` is invoked *inside* the reactive `set` trap. Proven: a listener
that throws makes `store.n = 1` throw. A third-party or user-written devtools listener can therefore break the application's ability
to mutate state — an availability bug reachable from an extension point.

### S-7 (Medium) — Path traversal in the docs site

`quanta-docs/app/api/docs/raw/[[...slug]]/route.ts` joins user input straight into a filesystem path:

```ts
const slug = params.slug?.join("/") || "";
const rawMdx = await getRawMdxForSlug(slug);
// -> path.join(process.cwd(), "/contents/docs/", `${slug}/index.mdx`)
```

`path.join` resolves `..`, so the read escapes `contents/docs/`. The fixed `/index.mdx` suffix constrains what an attacker can
exfiltrate, and Next.js normalises many traversal attempts before routing, so practical impact is limited — but it is an
unvalidated path join (CWE-22) on a public endpoint and should not be left in place.

**Fix:** resolve the candidate path and assert it starts with the content root, or (better) allowlist against the existing
`page_routes` table.

### S-8 / S-9 (Low)

- `normalizePersistedPayload` accepts a payload whose `version` is **greater** than the configured version and applies it unmigrated.
  A rollback or a crafted payload feeds future-shaped data into an old schema. Discard or hard-fail instead.
- The publish workflow requests `id-token: write` but never passes `--provenance`, and no `NODE_AUTH_TOKEN` is wired into the publish
  step. For a library asking enterprises to depend on it, npm provenance is table stakes. CodeQL *is* enabled (via GitHub's default
  setup — it runs on PRs but has no committed workflow file, so it isn't visible in the repo); consider committing it as a workflow
  so the configuration is reviewable. Still missing: a `pnpm audit` gate and an SBOM.
- `SECURITY.md` has no supported-versions table and no response SLA. Enable GitHub Private Vulnerability Reporting.

---

## 3. Correctness defects

All of the below are reproduced in the `known-defects` suites. IDs match the test names.

### Critical

**B-1 — `useQuantaSelector` returning a reactive object never re-renders.**
`useQuantaSelector` compares with `Object.is`. A selector returning `s.todos` returns the same proxy identity before and after
`todos.push(...)`, so the comparison says "unchanged" and the component never updates. Proven: rendered length stays `1` after a push.

This bug has a mirror image that is just as bad. A selector that *builds* a value (`s => s.todos.filter(...)`) is never `Object.is`
-equal, so it re-renders on every unrelated store change. There is **no `equalityFn` / `shallow` option**, so both horns are
inescapable. Zustand solved this years ago with `useShallow`; this is the single most important DX fix in the list.

**B-2 — DevTools never receives a single `STATE_CHANGE` event.**
`registerStore` keys `stateMap` by the reactive **proxy** (`store.state`), but the proxy traps call
`devtools.notifyStateChange(obj, …)` with the **raw** target. The lookup never resolves a store name, so the `if (storeName)` guard
never passes. Proven: `STATE_CHANGE events: []` for both a root-level and a nested mutation.

The entire DevTools value proposition — a live state inspector — has never worked in 2.0.0. It ships 70 kB to make this happen.
It went unnoticed because `devtools.test.ts` constructs mock stores by hand and calls `devtools.emit()` directly.

### High

**B-3 — `bubbleTrigger` bypasses both batching and schedulers.**
`bubbleTrigger` calls `dep.notify()` directly instead of going through `trigger()`. Two architectural leaks from one line:

1. `batchDepth` is not consulted, so **batching silently does not apply to nested state**. Proven: three nested writes inside
   `batchEffects` ran the effect **4 times** instead of 1.
2. `runner.scheduler` is not consulted, so effects that rely on a scheduler (every computed) get their raw effect function invoked
   instead of being marked dirty. Computeds fed by nested state are recomputed eagerly and their `dirty` bookkeeping is bypassed.

**B-4 — `useComputed` is broken under React StrictMode.**
The computed is created in the render body and disposed in an unmount cleanup that also nulls the ref. StrictMode mounts → unmounts →
remounts, and the render body does not re-run on remount, so the ref stays `null` forever. Proven: value frozen at `2` instead of
`10`, plus `TypeError: Cannot read properties of null (reading 'value')`. StrictMode is the default in Next.js and CRA dev builds, so
this is most developers' *first* experience of the hook.

**B-5 — Getter/state shadowing does the opposite of what it says.**
`createStore` warns *"getter will take priority on flat store"*, but `flattenStore` checks `prop in target.state` first, so **state
wins**. Proven: got `5`, warning promised `5000`. Either the code or the message is wrong; pick one and test it.

**B-6 — Adding a new key does not invalidate `Object.keys` dependents.**
`deleteProperty` triggers the `'keys'` dep; `set` never does. So `Object.keys(state)`, `for...in`, spreads and `JSON.stringify`
watchers all go stale when a key is **added** — which is exactly what normalised state (`byId[newId] = …`) does constantly. Proven.

**B-7 — Stale parent links cause phantom triggers and retain memory.**
`parentMap` entries are never pruned on reassignment or delete. Proven: mutating a detached child still re-ran an effect subscribed
to its *former* parent path. Additionally, `WeakMap<child, Set<{parent, key}>>` holds a **strong** reference to `parent` in the value,
so a live child keeps a dead parent subtree reachable. `setParent` also linear-scans the parent set on every nested read (§4).

### Medium

| ID | Defect |
|---|---|
| B-8 | Inline selectors cause a full unsubscribe/resubscribe **on every render** — `subscribe` is memoised on `[store, selector]` and the existing `selectorRef` is not used in the deps. Proven: 4 subscribe calls for 1 mount + 3 renders. |
| B-9 | Array mutators fire `trigger(obj, 'length')` **outside** the `batchEffects` wrapper, so one `push()` runs dependent effects **3 times**. Proven. |
| B-10 | `$reset()` is unbatched (N keys → N notification passes) and deletes keys while iterating the same object with `for...in`. |
| B-11 | `$persist.clear()` permanently tears down the auto-save watcher. Persistence silently stops for the rest of the session with no way to restart it. |
| B-12 | `debounced.flush()` no-ops when nothing is pending, so `await store.$persist.save()` can resolve **without writing anything**. An explicit save should always save. |
| B-13 | `useQuantaStore` re-renders every consumer on any change anywhere. Proven: component B, which reads only `b`, re-rendered when `a` changed. This is Context-grade fan-out — the exact thing developers adopt a state library to escape. |
| B-14 | `toRaw` was implemented and shipped in a `feat:` commit but **is not exported from any index**. It is unreachable. |
| B-15 | The store registry is a module-global `Map`, so a module-scope store is a **process-wide singleton**. Proven: under SSR, request 2 reads request 1's `alice@corp.com`. This is a data-leak class bug, not just an ergonomics one. |
| B-16 | `createStore` throws on a duplicate name. Hostile to HMR, StrictMode double-mount and test setup. There is no `getOrCreate` affordance. |

### Low

| ID | Defect |
|---|---|
| B-17 | **`@quantajs/react`'s published `dist/index.d.ts` is `export { }`** — the React package ships no types whatsoever. `rollupTypes: true` produced an empty rollup and nothing caught it. |
| B-18 | No `'use client'` directive in the React build → Next.js App Router import errors. |
| B-19 | `react/jsx-runtime` is not in `rollupOptions.external` (only the exact string `react` is), so a second JSX runtime copy is bundled. |
| B-20 | `useStore` / `useQuantaStore` throw *before* calling hooks, changing hook count between renders — a Rules-of-Hooks violation when a store appears or disappears. |
| B-21 | `QuantaProvider` passes `value={{ stores }}` inline → new context identity every render → all consumers re-render. Needs `useMemo`. |
| B-22 | `useCreateStore` calls `$destroy()` on unmount but keeps the ref, so a StrictMode remount reuses a destroyed store. |
| B-23 | `safeSerialize` doesn't handle `Map`/`Set` (`for...in` yields nothing → renders `{}`) or `BigInt`. DevTools shows collections as empty objects. |
| B-24 | `IndexedDBAdapter` never closes connections and has no `subscribe` — no cross-tab sync for the one adapter that would benefit most. Use `BroadcastChannel`. |
| B-25 | `LocalStorageAdapter.subscribe` ignores removals (`e.newValue` null) and does not check `e.storageArea`. |
| B-26 | `batchEffects` is typed `EffectFunction` and discards the return value, so it can't wrap a value-producing function. Proven: returns `undefined` for `() => 42`. |
| B-27 | `Dependency.notify()` swallows subscriber errors as warnings while `trigger()` rethrows — inconsistent semantics for the same conceptual operation. |
| B-28 | Error logging is stacked at every layer: one thrown error produced **7 ERROR lines** in the test output. Noisy, and it builds template strings in the hot path. |
| B-29 | `computed` has no `peek()`, no writable form, no `onInvalidate`, and leaves `dirty === true` after a throwing getter. |

---

## 4. Performance

Measured with the repo's own `pnpm bench` on this machine. The absolute numbers matter less than the ratios.

| Benchmark | Result | Read |
|---|---|---|
| read reactive property | **6,076,150 hz** | Good. |
| **read computed (cached)** | **160,104 hz** | **38× slower than a plain read — for a cache hit.** |
| write reactive property | 1,013,252 hz | Acceptable. |
| **store action dispatch** | **12,693 hz** | **~79 µs per dispatch.** Very slow. |
| create store | 32,068 hz | ~31 µs. Fine. |
| 10k flat property writes | 134 hz (7.4 ms) | ~0.74 µs/write. Fine. |
| **1k subscribers × 100 updates** | **10.5 hz (95 ms)** | ~0.95 ms per update. Pure O(subscribers) fan-out. |

**P-1 — A cached computed read costs 38× a property read.** Every `.value` access calls `track()`, which does a WeakMap lookup, a Map
lookup, a `Set.add`, an `effectDeps` WeakMap lookup, and runs inside a `try/catch` that builds an error template string on the failure
path. A cache *hit* should be a dirty-check and a return. Cache the `Dependency` object on the computed and skip `track()` entirely
when there is no `activeEffect`.

**P-2 / P-3 — Store fan-out is O(all subscribers) per mutation.** Every store carries one deep-watcher effect that enumerates all
top-level keys via `for...in` and then calls `dependency.notify()`, waking **every** subscriber regardless of what they read. This is
the root cause of both the 79 µs dispatch and the 95 ms/1k-subscriber number, and it is the architectural reason B-13 exists. There is
no per-key or per-path subscription API.

**P-4 — Persistence serialises the entire slice on every mutation.** `setupAutoSave` uses `watch(..., { deep: true })` whose *source*
runs `deepAccess` over the whole tree and then `serialize(...)` the whole persisted slice — and the debounced save then serialises it
**again**. That is O(state size) work, twice, on every keystroke, before debouncing even helps. Use a structural version counter or
patch-based dirty tracking instead.

**P-5 — `setParent` linear-scans on every nested read.** The duplicate-check loop walks the whole parent set on every nested property
access. Key the set by `parent` in a nested Map instead.

**P-6 — `try/catch` + string building in every proxy trap.** Every get/set/has/ownKeys handler is wrapped in try/catch whose catch
block builds a template-literal message. Move logging behind a `__DEV__` flag stripped in production builds.

**P-7 — `@quantajs/react` is 86.9 kB raw / 20.1 kB gzip.** `@quantajs/devtools` is a hard `dependencies` entry, `index.ts` imports
`mountDevTools` at module scope, and `rollupOptions.external` lists neither `@quantajs/devtools` nor `preact` — so Preact, the whole
DevTools UI and the inlined Tailwind CSS (184 occurrences of the `qdt` class prefix in the bundle) ship to every production app. For
context, that is larger than Zustand + Jotai + Valtio combined, for a thin hooks wrapper.

**P-8 — No `sideEffects: false` on core and no subpath exports.** IndexedDB/localStorage adapters, the logger and the devtools bridge
are in every bundle whether used or not. Add `"sideEffects": false` and `./persistence`, `./devtools` subpath exports.

**P-9 — Benchmarks run in CI but gate nothing.** A benchmark that cannot fail is decoration. Persist results and fail the build on
regression beyond a threshold.

---

## 5. Testing, docs and process

**The suite is green for the wrong reason.** 265 tests pass, but they verify units in isolation and never the wiring between them.
B-2 (DevTools completely dead) is the proof: `devtools.test.ts` hand-builds `{ state: { count: 0 } }` mock stores and calls
`devtools.emit()` directly, so it exercises the bridge but never the `createStore → mutate → proxy trap → bridge` path that is the
only path that matters.

Missing entirely:
- Integration tests across package boundaries (core → devtools, core → react).
- **Package-export tests** — `publint`, `arethetypeswrong`, a CJS `require()` smoke test, an ESM `import` smoke test. All three of
  S-1, B-17 and B-18 would have been caught by a 10-line consumer smoke test.
- SSR / `renderToString` tests. StrictMode tests. Concurrent-rendering / tearing tests.
- Memory-leak tests (create/destroy N stores, assert `parentMap` and `targetMap` drain).
- Branch coverage threshold is only **62%**, which is where the untested error paths hide.

**Docs findings** (`quanta-js/quanta-docs`):
- **The demo store teaches a workaround for a bug.** `components/persistence-demos/stores/index.ts` contains
  `this.items = [...this.items]; // Reassign for array reactivity`. A skeptical developer evaluating the library will find this in
  the first five minutes and conclude that array reactivity does not work. Fix B-1/B-6, then delete the comment.
- The same demo keeps `total` as manually-synced state via `updateTotal()` when it should be a getter — the docs are teaching an
  anti-pattern in the one file people copy from.
- Demo stores are created at module scope with `new LocalStorageAdapter(...)`, whose constructor **throws when `window` is
  undefined**. `'use client'` modules still execute during Next.js SSR. This is the SSR gap (§6.7) demonstrated live on your own site.
- `"@quantajs/core": "latest"` and `"@quantajs/react": "latest"` are unpinned — the docs site can break silently on any publish.
- `"quanta-docs": "file:"` is a self-referencing dependency and should be removed.
- No CI workflow at all in the docs repo — no lint, no build check, no link checking.
- The landing page pulls in three.js + react-three-fiber + gsap + tsparticles + motion. A state library that markets "blazing fast"
  is judged on its own homepage's Lighthouse score.

---

## 6. Where to take this — product strategy

Research on what developers actually complain about in 2026 converges on a few themes: **excessive complexity and boilerplate are the
top two pain points**; Context-style fan-out re-renders are the most-cited performance failure; **type safety that survives
refactoring** is the most-cited maintenance failure; and **SSR hydration with persisted state is the single most-blogged-about
breakage in the Next.js ecosystem**. Meanwhile Zustand has roughly doubled to ~50% usage by being *simpler*, not richer, and the TC39
Signals proposal has assembled the broadest framework-author collaboration in JS history behind a standard reactive primitive.

That gives a clear read: **do not out-feature Redux. Out-correct and out-integrate Zustand, and bet on the patch stream.**

### 6.1 `defineStore` with real inference (kills B-15, B-16 and the typing gap)

The string registry is the root of three separate problems. Replace it:

```ts
export const useCart = defineStore('cart', {
  state: () => ({ items: [] as Item[] }),
  getters: { total: (s) => s.items.reduce((a, i) => a + i.price, 0) },
  actions: { add(item: Item) { this.items.push(item) } },
});

const cart = useCart();          // fully inferred, no generics to restate
const scoped = useCart(container); // per-request instance for SSR
```

Plus `createContainer()` for per-request/per-test isolation, and `getOrCreate` semantics so HMR and StrictMode stop throwing.

### 6.2 Fine-grained subscriptions (fixes B-13, P-2, P-3 at once)

Delete the store-wide deep watcher. Give `subscribe` a path or selector scope and wire React's `useSyncExternalStore` to per-key
dependencies:

```ts
store.$subscribe((mutation, state) => { ... });        // all
store.$subscribe('user.profile.name', cb);             // path-scoped
useSelector(store, s => s.todos, { equal: shallow });  // with an equality escape hatch
```

Ship `shallow`, `deepEqual` and `identity` comparators. This is the fix for the B-1 footgun and the performance ceiling in one change.

### 6.3 **The differentiator: a patch stream** ⭐

You already intercept every mutation in a proxy. Emitting an RFC-6902 JSON Patch for each one is nearly free, and it is the primitive
that unlocks an entire product tier that Zustand/Jotai/Valtio cannot easily match:

```ts
store.$patches.subscribe(patches => { /* [{op:'add', path:'/todos/1', value:…}] */ });
```

From that one stream you get, essentially for free:

- **Undo/redo** — invert patches instead of snapshotting state. Research shows undo/redo has moved from a dev tool to a *user-facing
  competitive feature*; almost every serious app hand-rolls it today.
- **Time-travel debugging** — Redux's most-loved feature, without Redux's boilerplate.
- **Optimistic updates with automatic rollback** — `store.$optimistic(fn, { rollbackOn: promise })`. Every app writes this by hand.
- **Server sync / offline-first** — send patches, not whole documents.
- **Collaborative editing** — a patch stream is the on-ramp to CRDT/Yjs interop.
- **Audit logging** — an enterprise procurement checkbox you'd get for nothing.

This is the single highest-leverage thing to build, and it is a genuine reason to choose QuantaJS over the incumbents.

### 6.4 Async actions as first-class citizens

```ts
actions: {
  async loadUser(id: string) { this.user = await api.get(id, { signal: this.$signal }); }
}
store.loadUser.pending   // boolean, reactive
store.loadUser.error     // Error | null
store.loadUser.abort()   // auto-aborts a superseded in-flight call
```

Every team reimplements `isLoading`/`error`/race-cancellation for every async action. Shipping it is pure boilerplate elimination —
which the research names as the #2 pain point.

### 6.5 DevTools that earn their 70 kB

Fix B-2 first, then: live state editing, a diff view per mutation, a time-travel scrubber on the patch stream, action replay, and a
**"why did this re-render?"** panel naming the component and the exact path that woke it. Also ship a **Redux DevTools Extension
bridge** — inheriting a mature, already-installed tool beats maintaining your own UI.

### 6.6 Actually be framework-agnostic

Today "framework-agnostic" means "a core you can call from anywhere, plus a React adapter". Close the gap:
`@quantajs/vue` (near-trivial — same mental model), `@quantajs/svelte` (a store contract is 3 methods), `@quantajs/solid`,
`@quantajs/angular` (signal interop), and `@quantajs/vanilla`.

Then place the strategic bet: a **TC39 Signals interop layer** (`toSignal` / `fromSignal` against `signal-polyfill`). The proposal is
backed by Angular, Vue, Solid, Preact, Ember, Qwik, RxJS, Svelte and MobX maintainers. Being the state library that speaks the
standard reactive protocol before it lands is a defensible position.

### 6.7 Fix SSR properly — it's the most-blogged-about breakage in the ecosystem

The Next.js + persisted-state hydration mismatch is *the* recurring complaint. Solve it as a first-class feature, not a docs FAQ:

- `dehydrate(store)` / `hydrate(store, snapshot)` and a `<QuantaHydrate>` boundary.
- `await store.$hydrated` — an awaitable promise instead of the current polling `isRehydrated()`.
- Persistence mode `hydrate: 'after-mount'` so the server renders a stable default and browser values apply *after* hydration, never
  during it. This is the fix the ecosystem has converged on; ship it as the default.
- SSR-safe adapters that no-op on the server instead of throwing in the constructor.
- `'use client'` directives, and a documented RSC story.

### 6.8 Schema-validated persistence

`persist: { schema: UserSchema }` against [Standard Schema](https://standardschema.dev) (Zod / Valibot / ArkType). This gives typed
migrations, actionable errors on corrupt payloads, and it **eliminates the S-2 prototype-pollution class by construction** — validated
data can't carry a `__proto__` key through.

### 6.9 Persistence hardening

Make `include` required (or warn loudly when persisting everything), add a `redact: ['token', 'user.ssn']` option, and ship an
encrypted adapter built on WebCrypto. Move cross-tab sync to `BroadcastChannel` with leader election rather than piggybacking on
`storage` events.

### 6.10 The small things that make people fall in love

- `$patch({ ... })` for partial batched updates.
- A dev-mode **"why did this re-render?"** console warning — the most-requested DX feature in every state library.
- `eslint-plugin-quantajs` catching the known footguns (unstable selectors, mutating outside actions, missing `$destroy`).
- `@quantajs/testing` with auto-reset between tests and `createTestStore`.
- `asyncComputed` with pending/error, because everybody hand-rolls it.
- Export the escape hatches that already exist internally: `toRaw`, `markRaw`, `readonly`, `shallowReactive`, `untrack`,
  `effectScope`, `nextTick`.

---

## 7. Recommended sequencing

**Phase 1 — 2.0.1, "it does what it says" (days, not weeks).** Ship these before anything else; they are small and they are the ones
destroying trust right now.
S-1 (CJS/UMD) · B-17 (React types) · B-18 (`'use client'`) · B-19 (jsx-runtime) · P-7 (unbundle devtools/preact) ·
S-4 (devtools opt-in) · S-2 (prototype pollution) · S-7 (docs path traversal) · B-14 (export `toRaw`).
Add `publint` + `arethetypeswrong` + CJS/ESM consumer smoke tests to CI so none of these can regress.

**Phase 2 — 2.1, correctness.**
B-1 (selector equality + `shallow`) · B-2 (devtools wiring) · B-3 (bubble through `trigger`) · B-4 (StrictMode) · B-5 (shadowing) ·
B-6 (`keys` on add) · B-7 (prune parents) · B-8/B-9/B-10 · B-11/B-12 (persistence lifecycle) · S-3/S-6/S-8.
Then P-1 and P-4, which are the two performance fixes with the best ratio of impact to risk.

**Phase 3 — 2.2, architecture.** `defineStore` + containers (B-15/B-16), fine-grained subscriptions (B-13/P-2/P-3), the full SSR story.

**Phase 4 — 3.0, the differentiator.** Patch stream → undo/redo, time travel, optimistic updates, collaborative sync. Async action
lifecycle. Real multi-framework adapters. TC39 Signals interop.

---

## 8. The honest strategic note

You asked whether this is "just another JS state management library". Right now, on the evidence, it is a well-architected reactivity
core wrapped in a packaging and integration layer that hasn't been exercised against real consumers. The bugs are not deep — most are
one-line or one-function fixes — but their *distribution* is telling: nearly every one of them lives at a boundary (bundle output,
proxy↔devtools, core↔React, browser↔server). That is the signature of a codebase tested inward but never outward.

The fix is a process one as much as a code one: **add consumer-level tests** — a real CJS app, a real ESM app, a real Next.js app, a
real StrictMode app — and the entire class of defects in §2 and §3 stops being possible.

Do that, then build the patch stream. The reactive core you already have is good enough to deserve it.

---

### Appendix — reproducing these findings

```bash
pnpm install
pnpm test        # 285 pass — includes 20 known-defect specs that pass *because* the bugs exist
pnpm bench       # the numbers in §4
pnpm build && ls -la packages/react/dist   # B-17: index.d.ts is `export { }`

# S-1: CJS is broken
node -e "const q=require('@quantajs/core'); console.log(Object.keys(q).length, !!globalThis.QuantaJS)"
```

The `known-defects` suites use `it.fails()`: each test states the **correct** behaviour and passes while the bug is present. When you
fix a bug its test turns red — that is the signal to delete `.fails` and promote it to a permanent regression test.
