# @quantajs/svelte

## 3.0.0

### Major Changes

- b5170dd: **QuantaJS 3.0.** All packages now release together under one version. Alongside React, the framework-free core gains official bindings for Vue (`@quantajs/vue`), Svelte (`@quantajs/svelte`) and Lit (`@quantajs/lit`), and an Astro integration (`@quantajs/astro`) that lets React, Vue and Svelte islands share one store. 3.0 removes APIs that were deprecated or internal, types persistence end to end, and ships a smaller ES build. Migration guide: https://quantajs.com/docs/getting-started/migration

### Minor Changes

- b1e2454: New package: Svelte bindings. `useQuantaValue`, `useQuanta` and `useLocalStore` return Svelte stores, so `$` subscriptions work in Svelte 4 and 5; `useQuantaActions` returns the store itself. `setQuantaContainer()` scopes a component tree to a container, one per request under SvelteKit, and hydrates a server snapshot.

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
