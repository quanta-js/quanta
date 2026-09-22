---
'@quantajs/core': patch
---

Make `readonly()` reliable:

- `readonly(reactive(x))` returned the writable proxy; it now returns a readonly view that still tracks changes made through the original.
- `readonly()` and `shallowReadonly()` (and `reactive()` / `shallowReactive()` on a `Map` or `Set`) no longer share a proxy cache, so the first call can't decide the depth of the second.
- Frozen or sealed objects are returned as-is instead of being proxied, which previously threw on nested reads. `markRaw()` accepts them too.
