# @quantajs/devtools

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
