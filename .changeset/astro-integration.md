---
'@quantajs/astro': minor
---

New package: an Astro integration. Each request gets its own store container, used by default while the request renders and available as `Astro.locals.quanta`, so islands rendered on the server read that request's state. The state is written into the page and applied before any island hydrates, and React, Vue and Svelte islands on a page share one store. Works with prerendered pages and view transitions.
