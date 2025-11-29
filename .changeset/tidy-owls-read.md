---
'@quantajs/core': major
'@quantajs/devtools': major
'@quantajs/react': major
---

fix(devtools): enhance action log with expandable & copyable payloads

- Add PayloadCell component with expand/collapse and copy-to-clipboard functionality
- Replace raw JSON.stringify with safeSerializeCompact() to prevent crashes on circular references, functions, DOM nodes, etc.
- Add new safeSerialize and safeSerializeCompact utilities for robust object serialization
- Add tooltip (title) to store list items for long store names
- Minor cleanup and consistency fixes in StoreInspector and JSONTree