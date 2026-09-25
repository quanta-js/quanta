# @quantajs/astro

[![CI](https://github.com/quanta-js/quanta/actions/workflows/ci.yml/badge.svg)](https://github.com/quanta-js/quanta/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@quantajs/astro.svg)](https://www.npmjs.com/package/@quantajs/astro)

QuantaJS for [Astro](https://astro.build). One store, shared by every island whatever its framework, with state loaded on the server reaching the islands in the browser.

**[Documentation](https://quantajs.com/docs/integration/astro-integration)** · [Example app](https://github.com/quanta-js/quanta/tree/master/examples/astro) · [Changelog](https://github.com/quanta-js/quanta/blob/master/packages/astro/CHANGELOG.md)

- **Each request gets its own container.** Pages, middleware and islands rendered on the server all resolve stores against it, so concurrent requests never share state.
- **Server state reaches the islands.** The request's state is written into the page and applied before any island hydrates, so islands start from what the server rendered.
- **Islands share one store.** React, Vue and Svelte islands on one page read and change the same state, through their own bindings.

## Install

```sh
npm install @quantajs/core @quantajs/astro
```

Add the bindings for the frameworks your islands use: `@quantajs/react`, `@quantajs/vue` or `@quantajs/svelte`.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import quanta from '@quantajs/astro';

export default defineConfig({
    integrations: [quanta()],
});
```

## Usage

Define stores once, in plain TypeScript:

```ts
// src/stores/cart.ts
import { defineStore } from '@quantajs/core';

export const useCart = defineStore('cart', {
    state: () => ({ user: '', items: [] as string[] }),
    actions: {
        async load(user: string) {
            this.user = user;
            this.items = await fetchItems(user);
        },
        add(item: string) {
            this.items.push(item);
        },
    },
});
```

Load state in a page's frontmatter. Calling the store without a container uses the current request's; it is also available as `Astro.locals.quanta`.

```astro
---
// src/pages/cart.astro
import { useCart } from '../stores/cart';
import ReactCart from '../components/ReactCart';
import VueCount from '../components/VueCount.vue';

await useCart().load(Astro.url.searchParams.get('user') ?? 'guest');
---

<html>
    <head><title>Cart</title></head>
    <body>
        <ReactCart client:load />
        <VueCount client:load />
    </body>
</html>
```

Islands use the binding for their framework, with no provider or container:

```tsx
// src/components/ReactCart.tsx
import { useQuantaActions, useQuantaValue } from '@quantajs/react';
import { useCart } from '../stores/cart';

export default function ReactCart() {
    const items = useQuantaValue(useCart, (s) => s.items);
    const cart = useQuantaActions(useCart);
    return (
        <button onClick={() => cart.add('tea')}>{items.length} items</button>
    );
}
```

A change made in one island shows in every other island on the page, React, Vue or Svelte.

## How it works

- The integration adds middleware that runs first. It creates a container for the request, stores it in `Astro.locals.quanta`, and makes it the default container while the request renders, using Node's `AsyncLocalStorage`.
- When the page's `</head>` is sent, the middleware writes the container's state into a script. By then the page's frontmatter has run. The state is serialised with `devalue`, so `Date`, `Map` and `Set` survive and no value can break out of the script. The container is disposed once the page has been sent.
- In the browser, a script that Astro loads before hydrating any island applies that state to the default container, which every island resolves against. With view transitions, each new page's state is applied as it arrives.

## Things to know

- **Load state before the page's `<head>` is sent:** in middleware, or in the frontmatter of the page or its layout. A change made while rendering the page body, after the head, is not in the snapshot.
- **The server needs `AsyncLocalStorage`.** Node, Deno and Bun have it; on Cloudflare, enable `nodejs_compat`.
- **Prerendered pages** carry the state from build time.
- **API routes and other non-HTML responses** get a container too, and are passed through unchanged.

## License

MIT
