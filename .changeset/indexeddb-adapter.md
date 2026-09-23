---
'@quantajs/core': patch
---

`IndexedDBAdapter` reuses one database connection instead of opening a new one per read and write, closes it when another tab upgrades the database, and does nothing where `indexedDB` is unavailable (such as during SSR).
