# @quantajs/devtools

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

## 2.0.0-beta.9

### Major Changes

- feat(devtools): migrate to Preact + Shadow DOM and add test harness

### Patch Changes

- Updated dependencies
    - @quantajs/core@2.0.0-beta.9

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
