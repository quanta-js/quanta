---
'@quantajs/core': major
'@quantajs/react': major
---

Containers, `defineStore`, SSR hydration and async action lifecycle.

**Breaking.** The name-based store registry is replaced by containers. See the
migration notes at the end.

**`defineStore` — inference that actually reaches the call site**

`useStore<S, G, A>('cart')` required restating three generics at every call
site, so in practice most consumers got `any`. `defineStore` returns a typed
accessor instead:

```ts
export const useCart = defineStore('cart', {
  state: () => ({ items: [] as Item[] }),
  getters: { total: (s) => s.items.reduce((n, i) => n + i.price, 0) },
  actions: {
    add(item: Item) { this.items.push(item) },   // `this` is the whole store
  },
});

const cart = useCart();
cart.total;      // number
cart.add(item);  // typed
```

**Containers — per-request isolation**

A definition holds no state, so it is safe at module scope; state exists only
once resolved against a container. That closes the SSR data-leak where a
module-scope store was a process-wide singleton and one request's data was
visible to the next.

```ts
const container = createContainer();
useCart(container).add(item);
const snapshot = container.dehydrate();
container.dispose();
```

Also: `getDefaultContainer`, `setDefaultContainer`, `resetDefaultContainer`.
Resolving the same name twice in one container returns the existing instance,
so HMR, StrictMode and repeated test setup are safe — `createStore` no longer
throws on a duplicate name.

**SSR**

`container.dehydrate()` / `container.hydrate()`, `store.$dehydrate()` /
`store.$hydrate()`, and `<QuantaProvider snapshot={…}>` which hydrates during
render, before children mount, so the first client paint matches the server.
Snapshots for stores that do not exist yet are held until they are resolved, so
hydration order does not matter. `structuredClone` preserves Date/Map/Set.

**Async action lifecycle**

```ts
store.load.pending   // boolean, reactive
store.load.error     // Error | null
store.load.abort()
this.$signal         // AbortSignal, inside the action
```

Present on synchronous actions too, so making an action async later is not a
breaking change for callers. Deliberately minimal — no caching, retries or
invalidation; that is a server-state library's job.

**Also new:** `store.$patch(partial)` / `$patch(mutator)` for batched updates,
and `store.$id`.

**React**

- `useQuanta(definition)`, `useQuantaValue(definition, selector)` and
  `useQuantaActions(definition)` resolve against the nearest provider's
  container, falling back to the ambient one.
- `useLocalStore(definition)` gives a component its own container, disposed on
  unmount.
- `QuantaProvider` now takes `container` and `snapshot` instead of a `stores`
  map, and creates its own container when none is given.

**Migration**

- `createStore(name, options)` → `defineStore(name, options)`, then call it.
  `createStore` still exists and now takes an optional container.
- `useStore(name)` → call the definition. The name-based form remains but
  returns a loosely-typed store.
- `useCreateStore(name, state, getters, actions)` → `useLocalStore(definition)`.
- `<QuantaProvider stores={{...}}>` → `<QuantaProvider container={...}>`.
- `getOrCreateStore` is removed; `createStore` is idempotent per container.
- Server code must create a container per request. The ambient container is
  shared across every request in the process.
