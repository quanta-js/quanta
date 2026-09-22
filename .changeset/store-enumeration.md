---
'@quantajs/core': patch
---

`Object.keys(store)`, `{ ...store }` and `JSON.stringify(store)` no longer include the store's API (`$patch`, `subscribe`, `state`, `getters`, …). Keys and spread give state, getter values and actions; `JSON.stringify(store)` gives the state, via a new `toJSON()`.
