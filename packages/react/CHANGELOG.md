# @quantajs/react

All notable changes to this package are documented in this file.

## 2.0.0 - 2026-03-29

### Highlights

- First stable release of the QuantaJS React integration.
- Improved subscription correctness and selector stability for production usage.
- Better error boundaries and safer typing defaults for common hook patterns.

### Added

- Stable React integration built around `useSyncExternalStore` patterns.
- Broader automated coverage for hooks, provider behavior, and watcher/computed interactions.

### Changed

- `useQuantaStore` and selector flows now handle rapid updates with better cache invalidation behavior.
- `useWatch` behavior reconfiguration improved when options (`deep`, `immediate`) change.
- Generic defaults across hooks tightened to reduce permissive `any` inference.

### Fixed

- Missing-store and invalid-context error messaging consistency across hooks.
- Watch cleanup and callback exception handling to avoid subscription leaks.
- Selector edge cases where store/selector reference changes could yield stale values.

### Dependencies

- Updated to `@quantajs/core@2.0.0`.
- Updated to `@quantajs/devtools@2.0.0`.

## 2.0.0-beta.12

### Changed

- Build publishing flow updated to resolve `workspace:` protocol dependencies before publish.

### Dependencies

- Updated to `@quantajs/core@2.0.0-beta.12`.
- Updated to `@quantajs/devtools@2.0.0-beta.12`.

## 2.0.0-beta.11

### Changed

- Added Vitest coverage and workspace type-check integration.

## 2.0.0-beta.10

### Changed

- Large internal integration overhaul with improved reactivity and lifecycle semantics.

## 2.0.0-beta.9

### Changed

- Devtools and integration-layer updates.

## 2.0.0-beta.8

### Changed

- Devtools serialization and action-log UX improvements.

## 2.0.0-beta.7

### Changed

- Devtools bridge and runtime integration updates.

## 2.0.0-beta.6

### Changed

- Type inference and store API ergonomics upgrades.

## 2.0.0-beta.5

### Changed

- Lifecycle and deep-watch integration improvements.

## 2.0.0-beta.4

### Changed

- `useQuantaStore` refactor with cached snapshots and improved render behavior.

## 2.0.0-beta.3

### Changed

- Persistence integration and reliability improvements inherited from core.

## 2.0.0-beta.2

### Changed

- Multi-store provider/context behavior enhancements.

## 2.0.0-beta.1

### Added

- Early 2.x React integration baseline.

## 1.0.1-beta.0

### Added

- Initial React package release with core hook APIs.
