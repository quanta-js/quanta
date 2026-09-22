---
'@quantajs/react': patch
---

`useQuantaValue` / `useQuantaSelector` no longer subscribe during render, and pick up a store change made between render and subscription (previously the component kept the stale value until the next change).
