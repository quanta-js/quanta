---
'@quantajs/svelte': minor
---

New package: Svelte bindings. `useQuantaValue`, `useQuanta` and `useLocalStore` return Svelte stores, so `$` subscriptions work in Svelte 4 and 5; `useQuantaActions` returns the store itself. `setQuantaContainer()` scopes a component tree to a container, one per request under SvelteKit, and hydrates a server snapshot.
