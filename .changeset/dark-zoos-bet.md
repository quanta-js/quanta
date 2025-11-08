---
'@quantajs/react': major
'@quantajs/core': major
---

feat(react): refactor useQuantaStore with cached snapshots

\- Add store-level Set<subscribers> + notifyAll in createStore

\- Wire flattenStore.set trap → trigger + notifyAll

\- Generic Dependency<S> with snapshot-aware notify()

\- Update StoreSubscriber to (snapshot?: S) => void

\- Rewrite @quantajs/react useQuantaStore:

&nbsp; • useRef cache + fresh flat snapshot on every core mutation

&nbsp; • stable actions/getters (no re-bind loops)

&nbsp; • selector support for fine-grained re-renders

&nbsp; • SSR-safe server snapshot

&nbsp; • full error isolation (warn, never crash on bad subscriber)

\- Fix React re-render staleness: UI now updates instantly

\- Eliminate infinite-loop warning (cached snapshot is stable until dirty)Please enter a summary for your changes.

An empty message aborts the editor.
