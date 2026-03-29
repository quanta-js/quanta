# @quantajs/devtools

All notable changes to this package are documented in this file.

## 2.0.0 - 2026-03-29

### Highlights

- First stable release of QuantaJS DevTools.
- Runtime behavior hardened for mount lifecycle, bridge connectivity, and serialization safety.
- Added automated tests for key production paths.

### Added

- Automated coverage for:
  - bridge event processing (`STORE_INIT`, `STATE_CHANGE`, `ACTION_CALL`)
  - mount/unmount and no-op safety behavior
  - safe serialization edge cases (circular refs, depth/length limits, unsupported values)

### Changed

- Improved bridge retry and cleanup flow to avoid timer leaks and stale subscriptions.
- Reduced non-essential runtime console noise and improved failure resilience.
- Improved mount flow behavior for missing/invalid targets and repeated mount/unmount cycles.

### Fixed

- Action log and payload handling robustness for non-serializable or complex runtime values.
- Copy/inspect paths now fail safely in restricted browser environments.

### Dependencies

- Updated to `@quantajs/core@2.0.0`.

## 2.0.0-beta.12

### Changed

- Build publishing flow updated to resolve `workspace:` protocol dependencies before publish.

### Dependencies

- Updated to `@quantajs/core@2.0.0-beta.12`.

## 2.0.0-beta.11

### Changed

- Added Vitest coverage and workspace type-check integration.

## 2.0.0-beta.10

### Changed

- Large internal devtools/runtime overhaul with improved bridge and UI integration.

## 2.0.0-beta.9

### Changed

- Preact + Shadow DOM migration and local dev harness updates.

## 2.0.0-beta.8

### Changed

- Action log payload UX improvements and serialization safety additions.

## 2.0.0-beta.7

### Added

- Initial QuantaJS DevTools package and bridge-based event model.
