---
'@quantajs/core': patch
---

Effects, computed values and React selectors re-run 20–45% faster. A re-run no longer unsubscribes from and resubscribes to every dependency it reads; it keeps its subscriptions and releases only the ones it stopped reading.
