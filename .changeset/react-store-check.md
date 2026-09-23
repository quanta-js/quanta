---
'@quantajs/react': patch
---

`useQuantaStore` now reports a clear error during render when passed something that isn't a store (such as a store definition), instead of failing inside `subscribe`.
