---
'@quantajs/core': patch
'@quantajs/devtools': patch
---

DevTools fixes:

- Stores created before `enableDevTools()` now appear in the panel and report their changes. `<QuantaDevTools>` enables DevTools from an effect, after the first render has created the stores, so the panel previously showed none of them.
- `redact` now applies to the state and getters shown in the panel, and to keys nested inside a changed value. The panel previously rendered the live store, unredacted.
- Destroyed stores are removed from the panel, and bursts of state changes cause one panel render per frame.
