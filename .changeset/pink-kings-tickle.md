---
'@quantajs/core': major
'@quantajs/devtools': major
'@quantajs/react': major
---

feat(devtools): migrate to Preact + Shadow DOM and add test harness

- Move styles into shadow DOM, inject Tailwind/postcss for isolated CSS and update mount to render into a shadow root.
- Add store search/filter, UI refinements, Vite/dep updates and a local test/dev harness with mock stores.
