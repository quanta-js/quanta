---
'@quantajs/core': patch
---

Cut ~19% from nested property reads by consulting the reactive proxy cache
before the guards that a cache hit has already proven unnecessary.

Every nested read reaches `createReactive`, and almost all of them are cache
hits — the proxy for `state.user` is built once and returned on every
subsequent read. The cache lookup was last, behind `isNonReactiveBuiltin`
(nine checks, eight of them `instanceof`) and a `WeakSet.has`. A cached proxy
can only exist because a previous call ran those same guards and passed, so
every hit paid for a question already answered.

Measured on a cache hit: guards-then-lookup 30.5ns, lookup-first 5.4ns.

| Read | Before | After |
|---|---|---|
| depth 1 | 100.6 ns | 81.7 ns |
| depth 2 | 211.9 ns | 178.5 ns |
| depth 3 | 308.0 ns | 242.0 ns |
| depth 4 | 349.3 ns | 286.9 ns |

`markRaw` deliberately stays in front of the cache — it can be applied to an
object that is already reactive and must still win — and costs 0.6ns there.
The remaining guards run on a miss, which is once per object rather than once
per read.

No API change, no new data structures.
