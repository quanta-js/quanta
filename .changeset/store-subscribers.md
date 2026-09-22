---
'@quantajs/core': patch
---

`store.subscribe()` callbacks now always receive the store's state. Previously they got `undefined` for ordinary state changes and the state only from `notifyAll()`.

A subscriber that throws no longer fails silently: every subscriber still runs, then the first error is rethrown to the code that made the change, as with effects.
