---
'@quantajs/core': major
'@quantajs/react': major
---

Removed from the public API:

- `nextTick()` — effects flush synchronously; use `await Promise.resolve()`.
- `reactiveEffect` — use `effect`.
- `MigrationManager`, `createMigrationManager`, `CommonMigrations` — use `persist: { version, migrations }`.
- `createPersistenceManager` — stores create it from the `persist` option.
- `debounce`, `Logger`, `createLogger` — internal utilities. `logger` and `LogLevel` remain for silencing library warnings.

`@quantajs/react` no longer re-exports `nextTick`.
