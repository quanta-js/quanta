# @quantajs/devtools

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
