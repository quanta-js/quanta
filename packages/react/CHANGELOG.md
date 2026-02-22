# Changelog

## 2.0.0-beta.10

### Major Changes

- ## feat(core,react,devtools): overhaul reactivity, devtools UI, and persistence

    ### Summary

    This commit introduces a major internal upgrade to QuantaJS, improving reactivity correctness, performance, developer experience, and lifecycle safety across core, React bindings, and DevTools.

    ### Changes

    #### Core Reactivity
    - Added `batchEffects()` and batched array mutator handling
    - Migrated dependency tracking from object records to `Map`
    - Improved deep reactivity with explicit parent tracking and safer bubble triggering
    - Fixed computed invalidation and lazy recomputation behavior
    - Replaced polling-based deep `watch` with dependency-driven deep access
    - Improved circular dependency detection and error reporting

    #### Store Lifecycle & API
    - Added validation for name collisions between state, getters, and actions
    - Fixed `$reset()` to re-run state factory for fresh object references
    - Implemented full store cleanup via `$destroy()` and registry removal
    - Exported `batchEffects` as a public API
    - Simplified `flattenStore` trigger and notification logic

    #### Persistence
    - Centralized serialization/deserialization inside persistence manager
    - Updated storage adapters to return raw strings instead of parsed objects
    - Removed invalid cross-tab sync for `sessionStorage`
    - Fixed debounce utility naming typo

    #### React Integration
    - Reworked `useQuantaStore` to use version-based signaling with `useSyncExternalStore`
    - Prevented unnecessary snapshot reconstruction
    - Added automatic store destruction in `useCreateStore`
    - Stabilized selector comparisons using `Object.is`
    - Improved `QuantaContext` error handling with null-safe defaults
    - Fixed watcher cleanup and dependency stability in `useWatch`

    #### DevTools
    - Rebuilt DevTools UI using pure CSS (removed Tailwind, lucide, clsx)
    - Added inline SVG icon system with zero runtime dependencies
    - Added enable/disable switch for DevTools bridge
    - Improved action log, JSON inspector, and store management UX
    - Reduced bundle size and Shadow DOM complexity
    - Increased action history retention and improved store auto-selection

    #### Tooling & Documentation
    - Updated ESLint, TypeScript, Vite, Prettier, and Node type dependencies
    - Simplified DevTools build configuration
    - Added agent rules and in-depth project knowledge documentation
    - Updated README to reflect `createStore(name, { state: () => ... })` API

### Patch Changes

- Updated dependencies
    - @quantajs/core@2.0.0-beta.10
    - @quantajs/devtools@2.0.0-beta.10

## 2.0.0-beta.9

### Major Changes

- feat(devtools): migrate to Preact + Shadow DOM and add test harness

### Patch Changes

- Updated dependencies
    - @quantajs/core@2.0.0-beta.9
    - @quantajs/devtools@2.0.0-beta.9

## 2.0.0-beta.8

### Major Changes

- fix(devtools): enhance action log with expandable & copyable payloads
    - Add PayloadCell component with expand/collapse and copy-to-clipboard functionality
    - Replace raw JSON.stringify with safeSerializeCompact() to prevent crashes on circular references, functions, DOM nodes, etc.
    - Add new safeSerialize and safeSerializeCompact utilities for robust object serialization
    - Add tooltip (title) to store list items for long store names
    - Minor cleanup and consistency fixes in StoreInspector and JSONTree

### Patch Changes

- Updated dependencies
    - @quantajs/core@2.0.0-beta.8
    - @quantajs/devtools@2.0.0-beta.8

## 2.0.0-beta.7

### Major Changes

- feat(devtools): add QuantaJS DevTools with real-time state inspection and action logging
    - Introduce new @quantajs/devtools package with a floating panel UI
    - Add devtools bridge in core to emit STORE_INIT, STATE_CHANGE, and ACTION_CALL events
    - Instrument reactive proxies and store actions to notify devtools on mutations
    - Provide store inspector with live state tree, getters, actions, persistence controls, and reset functionality
    - Include action log panel showing timestamp, store, action name, and payload
    - Add auto-mount helper with dev-mode detection and global **QUANTA_DEVTOOLS** bridge exposure
    - Wire up Tailwind + Preact UI with dark theme, collapsible panel, and smooth animations

    chore(deps): update dev dependencies, updates tooling and linting dependencies to their latest patch/minor versions.

### Patch Changes

- Updated dependencies
    - @quantajs/core@2.0.0-beta.7
    - @quantajs/devtools@2.0.0-beta.7

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

### Patch Changes

- Updated dependencies
    - @quantajs/core@2.0.0-beta.6

## 2.0.0-beta.5

### Patch Changes

- Updated dependencies [ddf4edc]
    - @quantajs/core@2.0.0-beta.5

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

### Patch Changes

- Updated dependencies [9b5b301]
    - @quantajs/core@2.0.0-beta.4

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

### Patch Changes

- Updated dependencies
    - @quantajs/core@2.0.0-beta.3

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

### Patch Changes

- Updated dependencies
    - @quantajs/core@2.0.0-beta.2

## 2.0.0-beta.1

### Major Changes

- A clean, performant React integration that makes QuantaJS as easy to use in React, with minimal setup and maximum functionality for the QuantaJS state management library.

### Patch Changes

- Updated dependencies
    - @quantajs/core@2.0.0-beta.1

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1-beta.0] - 2025-01-27

### Added

- Initial React integration for QuantaJS
- `useQuantaStore` hook for subscribing to QuantaJS stores
- `useStore` hook for accessing stores from context
- `useCreateStore` hook for creating component-scoped stores
- `QuantaProvider` component for providing stores to React components
- `QuantaContext` for React context integration
- Full TypeScript support with proper type inference
- Comprehensive documentation and examples

### Features

- Reactive state management with automatic React re-renders
- Support for selectors to prevent unnecessary re-renders
- Integration with QuantaJS core features (reactive, computed, watch)
- Easy-to-use API similar to popular state management libraries
- Component-scoped state management capabilities
- Context-based global state sharing
