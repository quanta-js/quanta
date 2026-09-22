---
'@quantajs/core': patch
---

Persistence no longer loses the last change inside the debounce window: pending writes are flushed when the page is hidden or unloaded, and on `$destroy()` instead of being discarded.
