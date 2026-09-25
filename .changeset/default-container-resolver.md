---
'@quantajs/core': minor
---

`setDefaultContainerResolver(fn)` lets a server choose the default container for the code running now, typically the current request's from `AsyncLocalStorage`. Stores resolved without an explicit container, including by React, Vue or Svelte components rendered on the server, then use that request's container.
