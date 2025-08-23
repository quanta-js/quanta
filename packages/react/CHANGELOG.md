# Changelog

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
