---
'@quantajs/devtools': patch
---

Fix `require('@quantajs/devtools')` returning an empty object. The package now ships ES and CommonJS builds (`index.mjs` / `index.cjs`) instead of a UMD bundle, and no longer includes test declaration files.
