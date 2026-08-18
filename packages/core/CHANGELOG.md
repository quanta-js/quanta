# @quantajs/core

## 2.2.0

### Minor Changes

- 998b80e: Make the write path O(1) in the size of your state.

    A single `store.count++` on a store with 400 state keys cost **439
    microseconds**. The same write on a 5-key store cost 5.8µs — 76× the cost for
    80× the keys. Linear, in the operation an application performs most often. For
    scale, 439µs is about 3% of a 16ms frame budget for one property write.

    **Cause.** The store's coarse change-notifier was an effect whose body
    enumerated every state key so it would depend on all of them. An effect
    re-runs in order to re-register its dependencies, so every write re-read the
    entire store — each read paying a `WeakMap` lookup, a `Map` lookup and two
    `Set` inserts. `reactive()` itself was already O(1); the store was the problem.

    **Fix.** A per-object coarse channel (`ANY_CHANGE`) that `trigger` and
    `bubbleTrigger` notify alongside the per-key dependency. The notifier
    subscribes to exactly one dependency, and uses a `scheduler` so its body never
    re-runs — which is what removes the re-registration walk. It also fixes a
    latent gap: keys added after the store was created now notify without needing
    a re-enumeration.

    Alongside it, three constant-factor fixes on the same path:
    - **`Reflect.set(target, key, value, receiver)` re-enters the proxy's own
      `getOwnPropertyDescriptor` and `defineProperty` traps** — 209ns against 21ns
      for a direct assignment. The receiver only matters when an accessor must run
      with `this` bound to the proxy, so objects with no accessors on themselves or
      their prototype take the direct path. The check is made once per object and
      cached.
    - **`bubbleTrigger` allocated a queue and two `Set`s on every nested write.**
      Those exist for shared subtrees, which stay supported; a strictly linear
      parent chain — virtually all application state — now walks with no
      allocations at all.
    - **`notifyDependency` copied its subscriber set on every notification.** The
      copy exists because subscribers re-register themselves mid-iteration, but
      with exactly one subscriber there is nothing to iterate past. One dependency
      with one subscriber is the common shape.

    **Measured** (median of warmed runs, ratios are the reliable part):

    |                               | 2.1.1      | 2.2.0    |             |
    | ----------------------------- | ---------- | -------- | ----------- |
    | Store write · 5 keys          | 5,765 ns   | 200 ns   | 29×         |
    | Store write · 100 keys        | 77,701 ns  | 201 ns   | 386×        |
    | Store write · 400 keys        | 438,805 ns | 184 ns   | 2,385×      |
    | Growth 5 → 400 keys           | ×76        | ×0.92    | O(n) → O(1) |
    | Action dispatch · 400 keys    | 470,496 ns | 2,420 ns | 194×        |
    | Reactive write, no subscriber | 539 ns     | 94 ns    | 5.7×        |
    | Nested write · depth 1        | 903 ns     | 118 ns   | 7.7×        |
    | Nested write · depth 16       | 1,633 ns   | 421 ns   | 3.9×        |

    Repository benchmarks: `write reactive property` 2.47×, `10k flat property
writes` 3.10×, `store action dispatch` 1.77× on a small store.

    **No API change.** `ANY_CHANGE` is internal.

    Adds `write-path-complexity.test.ts`, which asserts the _structure_ that makes
    the timing possible rather than the timing itself — a timing assertion cannot
    gate CI on shared runners. It checks that the notifier subscribes to exactly
    one dependency regardless of state size, that the dependency set does not grow
    as writes accumulate, that late-added keys still notify, and that the coarse
    channel is released on dispose. Verified to fail against the old notifier.

### Patch Changes

- 14ddd78: Cut ~19% from nested property reads by consulting the reactive proxy cache
  before the guards that a cache hit has already proven unnecessary.

    Every nested read reaches `createReactive`, and almost all of them are cache
    hits — the proxy for `state.user` is built once and returned on every
    subsequent read. The cache lookup was last, behind `isNonReactiveBuiltin`
    (nine checks, eight of them `instanceof`) and a `WeakSet.has`. A cached proxy
    can only exist because a previous call ran those same guards and passed, so
    every hit paid for a question already answered.

    Measured on a cache hit: guards-then-lookup 30.5ns, lookup-first 5.4ns.

    | Read    | Before   | After    |
    | ------- | -------- | -------- |
    | depth 1 | 100.6 ns | 81.7 ns  |
    | depth 2 | 211.9 ns | 178.5 ns |
    | depth 3 | 308.0 ns | 242.0 ns |
    | depth 4 | 349.3 ns | 286.9 ns |

    `markRaw` deliberately stays in front of the cache — it can be applied to an
    object that is already reactive and must still win — and costs 0.6ns there.
    The remaining guards run on a miss, which is once per object rather than once
    per read.

    No API change, no new data structures.

## 2.1.0

### Minor Changes

- 29a9e74: ## 2.1.0

    A correctness, security and packaging pass over 2.0.0, plus containers,
    `defineStore`, SSR hydration and an async action lifecycle.

    2.0.0 shipped with defects that broke three of the claims on the tin, and the
    API shape that caused the fourth. Both are addressed here. Since 2.0.0 saw
    effectively no adoption, the API changes land as a minor rather than a major —
    but they **are** source-breaking, so the migration notes at the end are worth
    reading.

    ***

    ### Packaging

    |                             | 2.0.0                                                          | 2.1.0                    |
    | --------------------------- | -------------------------------------------------------------- | ------------------------ |
    | `require('@quantajs/core')` | `{}`, and 18 exports silently written to `globalThis.QuantaJS` | the real module          |
    | `@quantajs/react` types     | `export { }` — no types at all                                 | full declarations        |
    | `@quantajs/react` bundle    | 86.9 kB raw / 20.1 kB gzip                                     | **7.3 kB / 2.8 kB gzip** |
    - Core emitted UMD as `index.js` inside a `"type": "module"` package, so Node
      parsed it as ESM. It did not crash — it took the UMD wrapper's
      global-assignment branch. Now ESM + CJS.
    - React's declarations came from vite-plugin-dts's API-Extractor rollup, which
      silently produced nothing. They now come from `tsc`, which fails loudly.
    - Preact and the DevTools UI are no longer bundled into `@quantajs/react`;
      `@quantajs/devtools` is an optional peer behind a dynamic import.
      `react/jsx-runtime` is external, and `'use client'` is preserved for the
      Next.js App Router.
    - `sideEffects: false` on both packages.

    ### Security
    - **Prototype pollution.** Every path where outside data reaches state —
      persistence load, cross-tab sync, migrations, transforms, SSR snapshots — now
      rejects `__proto__` / `constructor` / `prototype`. Adds `sanitizePayload`,
      `safeJsonParse` and a safe default deserializer.
    - **DevTools is opt-in** via `enableDevTools()` and only attaches to `window`
      once enabled. It previously stayed on in any build where
      `process.env.NODE_ENV` was not statically replaced — a CDN bundle, Deno, a
      plain `<script type="module">` — exposing all state and every action
      argument. Adds a `redact` option for state paths and action arguments.
    - **Cross-tab sync** checks `storageArea`, contains parse failures, and refuses
      payloads claiming a newer schema version.
    - A throwing DevTools listener can no longer break application state writes.

    ### Reactivity
    - **Deep triggers now route through the same path as direct ones.**
      `bubbleTrigger` called `Dependency.notify()` directly, bypassing both the
      batch queue and effect schedulers — so `batchEffects()` silently did not
      apply to nested state, and computeds fed by nested state recomputed eagerly
      instead of invalidating. `Dependency` is now a container only, which makes
      that mistake unrepresentable.
    - Adding a property invalidates `Object.keys` / `for...in` / spread dependents.
    - Parent links are pruned on reassignment and delete: no more phantom
      invalidations from detached objects, and no retained subtrees.
    - Array mutators trigger once per call instead of three times.
    - `track()` returns early when nothing is tracking, so reads outside an effect
      no longer allocate dependency bookkeeping nobody consumes.
    - Diagnostics are `__DEV__`-gated and emitted once at the boundary rather than
      restacked at every layer — one error used to produce seven log lines.
    - `batchEffects()` returns its callback's value.
    - **A `computed` read through `store.subscribe()` could be one write stale.**
      Found by the new `examples/vanilla` verification app. A store's coarse
      "something changed" notifier and a getter's cache-invalidation are separate
      effects triggered by the same write, both deferred to the same
      `batchEffects` flush; the notifier happened to flush first, so it could read
      the getter before its cache had been invalidated — visible every other
      mutation once a getter had been read at least once. Getter invalidation
      (`EffectOptions.eager`) now runs immediately instead of waiting its turn in
      the batch queue.
    - **New:** `effect`, `effectScope`, `untrack`, `nextTick`, `toRaw`, `markRaw`,
      `readonly`, `shallowReactive`, `shallowReadonly`, `isProxy`, `isReadonly`.

    ### Stores: `defineStore` and containers

    The name-based registry was a module-global `Map`, and that one fact caused
    three separate problems: a module-scope store was a **process-wide singleton**
    (so under SSR one request's data was visible to the next),
    `useStore<S, G, A>(name)` forced callers to restate three generics (so in
    practice most consumers got `any`), and duplicate names threw (hostile to HMR,
    StrictMode and repeated test setup).

    `defineStore` returns a typed accessor; a container is the unit of isolation.

    ```ts
    export const useCart = defineStore('cart', {
        state: () => ({ items: [] as Item[] }),
        getters: { total: (s) => s.items.reduce((n, i) => n + i.price, 0) },
        actions: {
            add(item: Item) {
                this.items.push(item);
            }, // `this` is the whole store
        },
    });

    const cart = useCart(); // ambient container
    const scoped = useCart(request); // per-request instance
    ```

    A definition holds no state, so it is safe at module scope and safe to share
    across requests. Resolving the same name twice in one container returns the
    existing instance, so creation is idempotent.

    **New:** `createContainer`, `getDefaultContainer`, `setDefaultContainer`,
    `resetDefaultContainer`, `destroyAllStores`.

    ### SSR

    `container.dehydrate()` / `hydrate()`, `store.$dehydrate()` / `$hydrate()`, and
    `<QuantaProvider snapshot={…}>`, which hydrates **during render rather than in
    an effect** — an effect runs after first paint, which is precisely the
    hydration mismatch this prevents. A snapshot for a store that does not exist
    yet is held until it is first resolved, so hydration order does not matter.
    `structuredClone` preserves `Date`, `Map` and `Set` that a JSON round-trip
    would destroy.

    Storage adapters are SSR-safe: they degrade to a no-op on the server instead of
    throwing from their constructor.

    `store.$hydrated` is an awaitable promise, replacing the polling
    `$persist.isRehydrated()`.

    ### Async action lifecycle

    ```ts
    store.load.pending; // boolean, reactive
    store.load.error; // Error | null
    store.load.abort();
    this.$signal; // AbortSignal, inside the action
    ```

    Attached to synchronous actions too, so making an action async later is not a
    breaking change for its callers. Deliberately minimal — no caching, retries or
    invalidation, which belong to a server-state library.

    `pending` and `error` live on a reactive object separate from `state`, so the
    store's coarse change-notifier depends on both — otherwise `store.subscribe()`,
    and everything built on it including React's `useQuanta`, would miss a
    lifecycle change entirely unless the action happened to write state at around
    the same moment. One call notifies subscribers once, not once per field
    written; a synchronous action settles inside the same batch as its body.

    ### React
    - `useQuantaSelector` tracks **what the selector reads** rather than comparing
      its result. Comparison was broken in both directions against mutable proxies:
      `s => s.todos` never re-rendered after an in-place mutation, and
      `s => s.todos.filter(…)` re-rendered on every unrelated change. Subscriptions
      are fine-grained as a result — a component reading `s.a` is not woken by
      `s.b`. Adds `equalityFn` and a `shallow` comparator.
    - `useComputed` survives a StrictMode remount.
    - Inline selectors no longer resubscribe on every render.
    - **New:** `useQuanta`, `useQuantaValue`, `useQuantaActions`, `useLocalStore`.

    ### Persistence

    `clear()` re-arms auto-save instead of disabling it for the session; `save()`
    always writes; the slice is serialised once per write instead of twice per
    mutation.

    ### Also

    `store.$patch(partial)` and `$patch(mutator)` for batched updates;
    `store.$id`; getters now take priority over shadowed state, matching the
    warning that was already being emitted; `$reset()` runs as one batch.

    ***

    ## Migration from 2.0.0

    | Before                                          | After                                                                                                  |
    | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
    | `createStore(name, options)`                    | `defineStore(name, options)`, then call it. `createStore` still exists and takes an optional container |
    | `useStore(name)`                                | call the definition. The name-based form remains but returns a loosely-typed store                     |
    | `useCreateStore(name, state, getters, actions)` | `useLocalStore(definition)`                                                                            |
    | `<QuantaProvider stores={{ cart }}>`            | `<QuantaProvider container={container}>`                                                               |
    | `getOrCreateStore(...)`                         | removed — `createStore` is idempotent per container                                                    |
    | DevTools on by default                          | call `enableDevTools()` explicitly in development                                                      |
    | `$persist.isRehydrated()` polling               | `await store.$hydrated`                                                                                |

    Two behavioural changes to be aware of:
    - **Server code must create a container per request.** The ambient container is
      shared across every request in the process.
    - **A getter that shadows a state key now wins** on the flat store. Previously
      state won, contradicting the warning the library itself emitted. The state
      value remains reachable at `store.state.x`.

All notable changes to this package are documented in this file.

## 2.0.0 - 2026-03-29

### Highlights

- First stable release of the QuantaJS core runtime.
- Major reactivity overhaul with stronger correctness guarantees for dependency tracking and effect execution.
- Production-focused lifecycle hardening for stores, effects, computed values, and persistence.

### Added

- `batchEffects()` public API for batching reactive invalidations.
- Effect disposal lifecycle support (`stop`) with reliable dependency cleanup.
- Improved deep reactivity parent tracking and trigger bubbling for nested structures.
- `toRaw()` utility to safely unwrap reactive proxies to their raw targets.
- Persistence manager with adapters, migration support, validation hooks, and cross-tab synchronization.

### Changed

- Dependency tracking internals migrated to `Map`-based structures for better scalability.
- Computed evaluation behavior tightened with lazy and invalidation correctness improvements.
- Store lifecycle behavior improved for `$reset()` and `$destroy()` consistency.
- Collection reactivity semantics strengthened for `Map`/`Set` key handling and trigger consistency.

### Fixed

- Circular dependency detection and error reporting paths in effect scheduling.
- Batch failure behavior so queued effects are not executed after an aborted batch.
- Collection parent tracking edge cases in nested reactive collection scenarios.
- Persistence error handling and malformed payload flows with deterministic failure behavior.

### Breaking Notes

- Collection clear semantics are stricter: `Map.clear()` / `Set.clear()` now fully invalidate affected collection observers and key/value subscribers where applicable.
- Internal effect/persistence error paths are now stricter and more deterministic than earlier betas.

## 2.0.0-beta.12

### Changed

- Build publishing flow updated to resolve `workspace:` protocol dependencies before package publish.

## 2.0.0-beta.11

### Changed

- Introduced Vitest-based unit testing in the monorepo.
- Added recursive type-check flow and CI build integration.

## 2.0.0-beta.10

### Changed

- Large internal overhaul across reactivity, persistence, and tooling.
- Improved store validation and lifecycle behavior.
- Strengthened watch/computed correctness and deep trigger handling.

## 2.0.0-beta.9

### Changed

- Devtools architecture migration groundwork integrated with core bridge flows.

## 2.0.0-beta.8

### Changed

- Serialization safety improvements for devtools payload handling.

## 2.0.0-beta.7

### Added

- Initial devtools bridge events from core (`STORE_INIT`, `STATE_CHANGE`, `ACTION_CALL`).

## 2.0.0-beta.6

### Changed

- Type system upgrades for state/getter/action inference and store composition.

## 2.0.0-beta.5

### Added

- Store and persistence destroy lifecycle APIs.
- Deep watch support improvements.

## 2.0.0-beta.4

### Changed

- Snapshot and subscription behavior improvements supporting React integration.

## 2.0.0-beta.3

### Added

- Initial persistence manager with adapter and migration capabilities.

## 2.0.0-beta.2

### Added

- Store reset/restore improvements and multi-store compatibility groundwork.

## 2.0.0-beta.1

### Added

- Early 2.x pre-release foundation.

## 1.0.1-beta.0

### Changed

- Monorepo migration with pnpm, changesets, and improved OSS workflows.

## 1.0.0

### Changed

- Initial project publication.
