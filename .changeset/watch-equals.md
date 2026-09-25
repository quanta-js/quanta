---
'@quantajs/core': minor
'@quantajs/react': patch
---

`watch` takes an `equals` option to decide whether a re-run produced a new value, instead of always using `Object.is`. `shallow` is now exported from `@quantajs/core`; `@quantajs/react` re-exports it, so existing imports keep working.
