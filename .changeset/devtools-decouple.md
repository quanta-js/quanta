---
'@quantajs/core': patch
---

The DevTools bridge is no longer bundled unless you import `enableDevTools` (or `devtools`). The core reports through a small hook instead, cutting about 1.1–1.3 KB gzip from apps that don't use DevTools.
