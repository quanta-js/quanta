---
'@quantajs/core': major
'@quantajs/react': major
---

feat(core): add method to store for restoring initial state

- Introduced initialStateMap to track original state for each store
- Implemented method on the store instance to restore the state
- Triggered reactivity manually for both updated and deleted properties
- Extended Store and StoreInstance types to include

refactor(react): support multiple stores in QuantaProvider and useStore hook

- Updated QuantaProvider to accept a object instead of a single
- Modified QuantaContext to expose all stores by name
- Updated hook to require store name and handle missing stores
