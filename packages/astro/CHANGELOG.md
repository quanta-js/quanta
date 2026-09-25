# @quantajs/astro

## 3.0.0

### Minor Changes

- 44f5d36: New package: an Astro integration. Each request gets its own store container, used by default while the request renders and available as `Astro.locals.quanta`, so islands rendered on the server read that request's state. The state is written into the page and applied before any island hydrates, and React, Vue and Svelte islands on a page share one store. Works with prerendered pages and view transitions.

### Patch Changes

- Updated dependencies [f1bebc6]
- Updated dependencies [f23b69f]
- Updated dependencies [6c73998]
- Updated dependencies [6a6809d]
- Updated dependencies [de2131a]
- Updated dependencies [b5170dd]
- Updated dependencies [4a2f4e6]
- Updated dependencies [776e7bd]
- Updated dependencies [f826fa7]
- Updated dependencies [6528458]
- Updated dependencies [9af59f6]
    - @quantajs/core@3.0.0
