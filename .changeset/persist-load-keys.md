---
'@quantajs/core': patch
---

Persistence loads only the keys a store persists. Stored data written before a key was removed from `include`, or added to `exclude`, no longer loads that key into state.
