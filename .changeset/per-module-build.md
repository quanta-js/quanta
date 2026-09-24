---
'@quantajs/core': patch
---

The ES build now ships one file per module, so an app's bundler drops the modules it does not use. Every import path is 1.2–1.4 KB gzip smaller: `reactive` + `effect` from 5.7 to 4.4 KB, and `defineStore` with the React hooks from 10.3 to 9.1 KB. The CommonJS build is unchanged.
