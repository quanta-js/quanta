# @quantajs/svelte

[![CI](https://github.com/quanta-js/quanta/actions/workflows/ci.yml/badge.svg)](https://github.com/quanta-js/quanta/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@quantajs/svelte.svg)](https://www.npmjs.com/package/@quantajs/svelte)

Svelte bindings for [`@quantajs/core`](https://www.npmjs.com/package/@quantajs/core). QuantaJS stores as Svelte stores, for Svelte 4 and 5 and SvelteKit.

**[Documentation](https://quantajs.com/docs/integration/svelte-integration)** · [Example app](https://github.com/quanta-js/quanta/tree/master/examples/svelte-vite) · [Changelog](https://github.com/quanta-js/quanta/blob/master/packages/svelte/CHANGELOG.md)

## Install

```sh
npm install @quantajs/core @quantajs/svelte
```

## Usage

```ts
// lib/stores/todos.ts
import { defineStore } from '@quantajs/core';

export const useTodoStore = defineStore('todos', {
    state: () => ({ items: [] as { text: string; done: boolean }[] }),
    getters: {
        remaining: (s) => s.items.filter((t) => !t.done).length,
    },
    actions: {
        add(text: string) {
            this.items.push({ text, done: false });
        },
    },
});
```

```svelte
<!-- Todos.svelte -->
<script lang="ts">
    import { useQuanta, useQuantaActions, useQuantaValue } from '@quantajs/svelte';
    import { useTodoStore } from '$lib/stores/todos';

    // Notifies only when `remaining` changes.
    const remaining = useQuantaValue(useTodoStore, (s) => s.remaining);

    // The store, without subscribing: for calling actions.
    const actions = useQuantaActions(useTodoStore);

    // Notifies on any change to the store.
    const todos = useQuanta(useTodoStore);
</script>

<p>{$remaining} left</p>
<button onclick={() => actions.add('New todo')}>Add</button>
<ul>
    {#each $todos.items as t}
        <li>{t.text}</li>
    {/each}
</ul>
```

Each function returns a standard Svelte store, so `$` subscriptions work in components, and `fromStore` from `svelte/store` turns one into state in a `.svelte.ts` file. Subscriptions end when the component is destroyed, and a store tracks QuantaJS state only while something is subscribed.

No setup is needed in a client-only app: stores resolve against the default container.

| Function                                         | Notifies on             | Use for                                                     |
| ------------------------------------------------ | ----------------------- | ----------------------------------------------------------- |
| `useQuantaValue(definition, selector, options?)` | What the selector reads | Most components                                             |
| `useQuanta(definition)`                          | Any change to the store | Small stores, or components that read most of it            |
| `useQuantaActions(definition)`                   | Nothing                 | Components that only call actions; returns the store itself |
| `useLocalStore(definition)`                      | Any change to the store | A store instance owned by one component, disposed with it   |

A selector that builds a new object or array on every run should pass `shallow`, so an unchanged projection does not notify:

```ts
import { shallow, useQuantaValue } from '@quantajs/svelte';
import { useTodoStore } from '$lib/stores/todos';

export const summary = useQuantaValue(
    useTodoStore,
    (s) => ({ remaining: s.remaining, total: s.items.length }),
    { equalityFn: shallow },
);
```

## SvelteKit and server rendering

Call `setQuantaContainer()` in the root layout. On the server the layout renders once per request, so each request gets its own container; it is disposed when the layout is destroyed.

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
    import { setQuantaContainer } from '@quantajs/svelte';

    let { data, children } = $props();
    setQuantaContainer(undefined, { snapshot: data.snapshot });
</script>

{@render children()}
```

To load state on the server, resolve stores against a container in a `load` function and return its snapshot. The layout applies it before anything renders, so the client's markup matches the server's:

```ts
// src/routes/+layout.server.ts
import { createContainer } from '@quantajs/core';
import { useTodoStore } from '$lib/stores/todos';

export async function load() {
    const container = createContainer();
    useTodoStore(container).add('Loaded on the server');
    const snapshot = container.dehydrate();
    container.dispose();
    return { snapshot };
}
```

Never resolve stores against the default container on the server: it is shared by every request. Pass your own container to `setQuantaContainer(container)` to manage its lifetime yourself.

## DevTools

```sh
npm install -D @quantajs/devtools
```

```ts
import { enableDevTools } from '@quantajs/svelte';

if (import.meta.env.DEV) {
    enableDevTools({ redact: ['token'] });
    import('@quantajs/devtools').then(({ mountDevTools }) => mountDevTools());
}
```

## License

MIT
