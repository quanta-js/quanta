# @quantajs/core

All notable changes to this package are documented in this file.

## 2.0.0 - 2026-03-29

### Highlights

- First stable release of the QuantaJS core runtime.
- Major reactivity overhaul with stronger correctness guarantees for dependency tracking and effect execution.
- Production-focused lifecycle hardening for stores, effects, computed values, and persistence.

### Added

- `batchEffects()` public API for batching reactive invalidations.
- Effect disposal lifecycle support (`stop`) with reliable dependency cleanup.
- Improved deep reactivity parent tracking and trigger bubbling for nested structures.
- `toRaw()` utility to safely unwrap reactive proxies to their raw targets.
- Persistence manager with adapters, migration support, validation hooks, and cross-tab synchronization.

### Changed

- Dependency tracking internals migrated to `Map`-based structures for better scalability.
- Computed evaluation behavior tightened with lazy and invalidation correctness improvements.
- Store lifecycle behavior improved for `$reset()` and `$destroy()` consistency.
- Collection reactivity semantics strengthened for `Map`/`Set` key handling and trigger consistency.

### Fixed

- Circular dependency detection and error reporting paths in effect scheduling.
- Batch failure behavior so queued effects are not executed after an aborted batch.
- Collection parent tracking edge cases in nested reactive collection scenarios.
- Persistence error handling and malformed payload flows with deterministic failure behavior.

### Breaking Notes

- Collection clear semantics are stricter: `Map.clear()` / `Set.clear()` now fully invalidate affected collection observers and key/value subscribers where applicable.
- Internal effect/persistence error paths are now stricter and more deterministic than earlier betas.

## 2.0.0-beta.12

### Changed

- Build publishing flow updated to resolve `workspace:` protocol dependencies before package publish.

## 2.0.0-beta.11

### Changed

- Introduced Vitest-based unit testing in the monorepo.
- Added recursive type-check flow and CI build integration.

## 2.0.0-beta.10

### Changed

- Large internal overhaul across reactivity, persistence, and tooling.
- Improved store validation and lifecycle behavior.
- Strengthened watch/computed correctness and deep trigger handling.

## 2.0.0-beta.9

### Changed

- Devtools architecture migration groundwork integrated with core bridge flows.

## 2.0.0-beta.8

### Changed

- Serialization safety improvements for devtools payload handling.

## 2.0.0-beta.7

### Added

- Initial devtools bridge events from core (`STORE_INIT`, `STATE_CHANGE`, `ACTION_CALL`).

## 2.0.0-beta.6

### Changed

- Type system upgrades for state/getter/action inference and store composition.

## 2.0.0-beta.5

### Added

- Store and persistence destroy lifecycle APIs.
- Deep watch support improvements.

## 2.0.0-beta.4

### Changed

- Snapshot and subscription behavior improvements supporting React integration.

## 2.0.0-beta.3

### Added

- Initial persistence manager with adapter and migration capabilities.

## 2.0.0-beta.2

### Added

- Store reset/restore improvements and multi-store compatibility groundwork.

## 2.0.0-beta.1

### Added

- Early 2.x pre-release foundation.

## 1.0.1-beta.0

### Changed

- Monorepo migration with pnpm, changesets, and improved OSS workflows.

## 1.0.0

### Changed

- Initial project publication.
