---
'@quantajs/core': patch
'@quantajs/devtools': patch
'@quantajs/react': patch
---

Development mode is now detected from `process.env.NODE_ENV`, which app bundlers replace at build time. Production browser builds no longer print QuantaJS development warnings, and in Vite apps `mountDevTools()` and `<QuantaDevTools />` now show the panel in development without `visible`.
