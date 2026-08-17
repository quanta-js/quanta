---
'@quantajs/core': minor
'@quantajs/react': minor
'@quantajs/devtools': minor
---

## 2.1.0

A correctness, security and packaging pass over 2.0.0, plus containers,
`defineStore`, SSR hydration and an async action lifecycle.

2.0.0 shipped with defects that broke three of the claims on the tin, and the
API shape that caused the fourth. Both are addressed here. Since 2.0.0 saw
effectively no adoption, the API changes land as a minor rather than a major —
but they **are** source-breaking, so the migration notes at the end are worth
reading.

---

### Packaging

| | 2.0.0 | 2.1.0 |
|---|---|---|
| `require('@quantajs/core')` | `{}`, and 18 exports silently written to `globalThis.QuantaJS` | the real module |
| `@quantajs/react` types | `export { }` — no types at all | full declarations |
| `@quantajs/react` bundle | 86.9 kB raw / 20.1 kB gzip | **7.3 kB / 2.8 kB gzip** |

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
    add(item: Item) { this.items.push(item) },   // `this` is the whole store
  },
});

const cart = useCart();          // ambient container
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
store.load.pending   // boolean, reactive
store.load.error     // Error | null
store.load.abort()
this.$signal         // AbortSignal, inside the action
```

Attached to synchronous actions too, so making an action async later is not a
breaking change for its callers. Deliberately minimal — no caching, retries or
invalidation, which belong to a server-state library.

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

---

## Migration from 2.0.0

| Before | After |
|---|---|
| `createStore(name, options)` | `defineStore(name, options)`, then call it. `createStore` still exists and takes an optional container |
| `useStore(name)` | call the definition. The name-based form remains but returns a loosely-typed store |
| `useCreateStore(name, state, getters, actions)` | `useLocalStore(definition)` |
| `<QuantaProvider stores={{ cart }}>` | `<QuantaProvider container={container}>` |
| `getOrCreateStore(...)` | removed — `createStore` is idempotent per container |
| DevTools on by default | call `enableDevTools()` explicitly in development |
| `$persist.isRehydrated()` polling | `await store.$hydrated` |

Two behavioural changes to be aware of:

- **Server code must create a container per request.** The ambient container is
  shared across every request in the process.
- **A getter that shadows a state key now wins** on the flat store. Previously
  state won, contradicting the warning the library itself emitted. The state
  value remains reachable at `store.state.x`.
