---
'@quantajs/core': major
'@quantajs/devtools': major
'@quantajs/react': major
---

## feat(core,react,devtools): overhaul reactivity, devtools UI, and persistence

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
