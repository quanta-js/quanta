---
'@quantajs/core': major
---

Removed from the public API:

- `pauseTracking()` and `resumeTracking()`. Use `untrack(fn)`.
- `sanitizePayload()`, `safeJsonParse()` and `safeJsonReviver()`. Persisted and hydrated data is still sanitised automatically, and the default `deserialize` still drops prototype-pollution keys.
