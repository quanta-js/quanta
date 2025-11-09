---
'@quantajs/core': major
---

feat(core,persistence,state): add store and persistence destroy lifecycle + deep watch support

\- Added `$destroy()` method to store instances for explicit cleanup.

\- Enhanced persistence manager with:

&nbsp; - `destroy()` method for teardown (auto-save watcher, cross-tab sync, debounce).

&nbsp; - Auto-save watcher using new `watch()` API.

&nbsp; - Improved logging for save/load/destroy lifecycle.

\- Extended `watch()` utility to support `deep` and `immediate` options.

\- Updated persistence types with new `destroy()` method and `watch-setup` error case.

\- Improved store lifecycle management and cleanup reliability.
