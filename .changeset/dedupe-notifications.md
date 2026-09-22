---
'@quantajs/core': patch
---

A nested write now runs each dependent effect, computed and subscriber once. Previously an effect that read several levels of a nested object ran once per level, so a depth-8 write cost ~29µs; it now costs ~4µs.
