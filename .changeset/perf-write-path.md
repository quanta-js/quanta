---
'@quantajs/core': minor
---

Make the write path O(1) in the size of your state.

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

| | 2.1.1 | 2.2.0 | |
|---|---|---|---|
| Store write · 5 keys | 5,765 ns | 200 ns | 29× |
| Store write · 100 keys | 77,701 ns | 201 ns | 386× |
| Store write · 400 keys | 438,805 ns | 184 ns | 2,385× |
| Growth 5 → 400 keys | ×76 | ×0.92 | O(n) → O(1) |
| Action dispatch · 400 keys | 470,496 ns | 2,420 ns | 194× |
| Reactive write, no subscriber | 539 ns | 94 ns | 5.7× |
| Nested write · depth 1 | 903 ns | 118 ns | 7.7× |
| Nested write · depth 16 | 1,633 ns | 421 ns | 3.9× |

Repository benchmarks: `write reactive property` 2.47×, `10k flat property
writes` 3.10×, `store action dispatch` 1.77× on a small store.

**No API change.** `ANY_CHANGE` is internal.

Adds `write-path-complexity.test.ts`, which asserts the *structure* that makes
the timing possible rather than the timing itself — a timing assertion cannot
gate CI on shared runners. It checks that the notifier subscribes to exactly
one dependency regardless of state size, that the dependency set does not grow
as writes accumulate, that late-added keys still notify, and that the coarse
channel is released on dispose. Verified to fail against the old notifier.
