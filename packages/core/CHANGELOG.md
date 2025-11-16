# @quantajs/core

## 2.0.0-beta.6

### Major Changes

- \### Core Improvements

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

## 2.0.0-beta.5

### Major Changes

- ddf4edc: feat(core,persistence,state): add store and persistence destroy lifecycle + deep watch support

    \- Added `$destroy()` method to store instances for explicit cleanup.

    \- Enhanced persistence manager with:

    &nbsp; - `destroy()` method for teardown (auto-save watcher, cross-tab sync, debounce).

    &nbsp; - Auto-save watcher using new `watch()` API.

    &nbsp; - Improved logging for save/load/destroy lifecycle.

    \- Extended `watch()` utility to support `deep` and `immediate` options.

    \- Updated persistence types with new `destroy()` method and `watch-setup` error case.

    \- Improved store lifecycle management and cleanup reliability.

## 2.0.0-beta.4

### Major Changes

- 9b5b301: feat(react): refactor useQuantaStore with cached snapshots

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

## 2.0.0-beta.3

### Major Changes

- \## ✨ feat(core/persistence): add persistence manager with adapters \& migrations

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

## 2.0.0-beta.2

### Major Changes

- feat(core): add method to store for restoring initial state
    - Introduced initialStateMap to track original state for each store
    - Implemented method on the store instance to restore the state
    - Triggered reactivity manually for both updated and deleted properties
    - Extended Store and StoreInstance types to include

    refactor(react): support multiple stores in QuantaProvider and useStore hook
    - Updated QuantaProvider to accept a object instead of a single
    - Modified QuantaContext to expose all stores by name
    - Updated hook to require store name and handle missing stores

## 2.0.0-beta.1

### Major Changes

- A clean, performant React integration that makes QuantaJS as easy to use in React, with minimal setup and maximum functionality for the QuantaJS state management library.

## 1.0.1-beta.0

### Patch Changes

- chore: migrate project to monorepo structure with pnpm, changesets, and improved OSS workflows

## 1.0.0

### Patch Changes

- chore: migrate project to monorepo structure with pnpm, changesets, and improved OSS workflows
