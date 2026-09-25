---
'@quantajs/core': major
---

Removed:

- `useStore(name)` and `hasStore(name)`. Call the store definition instead (`useCart()` or `useCart(container)`); for a lookup by name use `container.get(name)` / `container.has(name)`.
- `store.notifyAll()`. Subscribers are called on every change.
- The deprecated type aliases. Use `ActionsTree` for `RawActions` and `ActionDefinition`, `GettersTree` for `GetterDefinitions`, `BoundActions` for `InferActions`, `Store` for `StoreInstance`, and `StoreDefinitionOptions` for `StoreOptions`.
