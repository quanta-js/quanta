# @quantajs/vue

## 3.0.0

### Major Changes

- b5170dd: **QuantaJS 3.0.** All packages now release together under one version. Alongside React, the framework-free core gains official bindings for Vue (`@quantajs/vue`), Svelte (`@quantajs/svelte`) and Lit (`@quantajs/lit`), and an Astro integration (`@quantajs/astro`) that lets React, Vue and Svelte islands share one store. 3.0 removes APIs that were deprecated or internal, types persistence end to end, and ships a smaller ES build. Migration guide: https://quantajs.com/docs/getting-started/migration

### Minor Changes

- 259eb8c: New package: Vue bindings. `useQuantaValue` returns a ref that updates only when the state its selector reads changes; `useQuanta`, `useQuantaActions` and `useLocalStore` match their React counterparts; `createQuanta()` gives an app its own container and hydrates a server snapshot.

### Patch Changes

- e0fb8fa: `createQuanta()` now disposes the container it created when the app unmounts on Vue 3.3 and 3.4 as well; it relied on `app.onUnmount`, which arrived in Vue 3.5.
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
