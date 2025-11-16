---
'@quantajs/react': major
'@quantajs/core': major
---

\### Core Improvements

\- Enhanced type system with `RawActions`, `GetterDefinitions`, `InferActions`, and full store-level type inference.

\- Reworked `StoreInstance` to correctly merge state, getters, and actions with proper return types.

\- Added deep reactive bubbling using `parentMap` and `bubbleTrigger()` for upward dependency propagation.

\- Introduced `reactiveMap` to cache proxies and prevent double-wrapping.

\- Improved nested reactivity with parent linking and cache-aware creation.

\- Added deep reactive watcher in `createStore`, plus pre-touching logic for stable dependency initialization.

\- Improved persistence typings and internal dependency maps.

\### Getters \& Actions

\- More accurate getter type inference and computed initialization.

\- Consistent getter unwrapping via new `resolveGetterValue` utility.

\- Strengthened action binding and flattening logic (`flattenStore` updates).

\- Improved set-trap behavior for stable action/getter merging.

\### React Integrations

\- Updated `useComputed`, `useQuantaStore`, `useCreateStore`, and `useWatch` to use the new typing model (`GDefs`, `RawActions`).

\- Major snapshot system rewrite:

&nbsp; - Snapshots now contain live reactive proxies (no more shallow flattening).

&nbsp; - Lazily rebuild snapshots only when invalidated.

&nbsp; - Selector mode now uses stable refs and avoids unnecessary re-renders.

&nbsp; - Improved server snapshot behavior.

\### Developer Experience

\- Updated ESLint rules:

&nbsp; - Disabled `unused-imports/no-unused-vars`.

&nbsp; - Enabled `@typescript-eslint/no-unused-vars` with underscore ignore convention.

\- Adjusted TS config to disable `noUnusedLocals` and `noUnusedParameters` for smoother development.

\### Debugging Enhancements

\- Added detailed logging for dependency tracking, bubbling behavior, proxy caching, and watcher initialization.
