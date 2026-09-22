---
'@quantajs/core': patch
---

Array iteration methods on reactive arrays (`map`, `filter`, `reduce`, `find`, `some`, `every`, `forEach`, `includes`, `indexOf`, `for…of`, spread and others) now track the array's contents once instead of every index. A computed summing a 1000-item array recomputes about 17× faster. Items passed to callbacks are still reactive.
