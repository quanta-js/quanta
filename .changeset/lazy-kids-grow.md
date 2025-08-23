---
'@quantajs/core': major
'@quantajs/react': major
---

\## ✨ feat(core/persistence): add persistence manager with adapters \& migrations

\### Scope

\- `core/persistence`

\### Changes

\- Added `createPersistenceManager` for managing persisted state with:

&nbsp; - Serialization/deserialization

&nbsp; - Debounced writes

&nbsp; - Include/exclude filters

&nbsp; - Data validation

&nbsp; - Cross-tab synchronization

&nbsp; - Versioning \& migrations support

\- Implemented storage adapters:

&nbsp; - `LocalStorageAdapter`

&nbsp; - `SessionStorageAdapter`

&nbsp; - `IndexedDBAdapter`

\- Introduced `MigrationManager` with:

&nbsp; - Add/remove/rename/transform property helpers (`CommonMigrations`)

&nbsp; - Migration validation

&nbsp; - Migration chaining from older to newer versions

\- Exposed all persistence APIs \& types via `persistence/index.ts`

\### Improvements

\- Enhances reliability by wrapping core reactivity, watchers, debounced functions, computed values, store access, and context usage in try/catch with detailed logging.
