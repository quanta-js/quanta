# @quantajs/vue

[![CI](https://github.com/quanta-js/quanta/actions/workflows/ci.yml/badge.svg)](https://github.com/quanta-js/quanta/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@quantajs/vue.svg)](https://www.npmjs.com/package/@quantajs/vue)

Vue bindings for [`@quantajs/core`](https://www.npmjs.com/package/@quantajs/core). Composables for Vue 3.3 and later, with server rendering support.

**[Documentation](https://quantajs.com/docs/integration/vue-integration)** · [Example app](https://github.com/quanta-js/quanta/tree/master/examples/vue-vite) · [Changelog](https://github.com/quanta-js/quanta/blob/master/packages/vue/CHANGELOG.md)

## Install

```sh
npm install @quantajs/core @quantajs/vue
```

## Usage

```ts
// stores/todos.ts
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

```vue
<!-- Todos.vue -->
<script setup lang="ts">
import { useQuanta, useQuantaActions, useQuantaValue } from '@quantajs/vue';
import { useTodoStore } from './stores/todos';

// A ref that updates only when `remaining` changes.
const remaining = useQuantaValue(useTodoStore, (s) => s.remaining);

// The store, without subscribing: for calling actions.
const actions = useQuantaActions(useTodoStore);

// The store, re-rendering this component on any change to it.
const todos = useQuanta(useTodoStore);
</script>

<template>
    <p>{{ remaining }} left</p>
    <button @click="actions.add('New todo')">Add</button>
    <ul>
        <li v-for="(t, i) in todos.items" :key="i">{{ t.text }}</li>
    </ul>
</template>
```

No plugin is needed in a client-only app: stores resolve against the default container.

## Composables

| Composable                                       | Updates on              | Use for                                                      |
| ------------------------------------------------ | ----------------------- | ------------------------------------------------------------ |
| `useQuantaValue(definition, selector, options?)` | What the selector reads | Most components; returns a read-only ref                     |
| `useQuanta(definition)`                          | Any change to the store | Small stores, or components that read most of it             |
| `useQuantaActions(definition)`                   | Nothing                 | Components that only call actions                            |
| `useLocalStore(definition)`                      | Any change to the store | A store instance owned by one component, disposed on unmount |

Call them in `setup()` or `<script setup>`. Subscriptions end when the component unmounts.

A selector that builds a new object or array on every run should pass `shallow`, so an unchanged projection does not update:

```ts
import { shallow, useQuantaValue } from '@quantajs/vue';

const summary = useQuantaValue(
    useTodoStore,
    (s) => ({ remaining: s.remaining, total: s.items.length }),
    { equalityFn: shallow },
);
```

QuantaJS stores have their own reactivity, separate from Vue's. Read them through these composables rather than wrapping them in `ref()` or `reactive()`. The reactivity primitives from `@quantajs/core` (`reactive`, `computed`, `watch`) are not re-exported here, because Vue has its own with the same names.

## Server rendering

Install `createQuanta()` once per app. On the server, create the app per request, so each request gets its own container:

```ts
// entry-server.ts
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createQuanta } from '@quantajs/vue';
import App from './App.vue';

export async function render() {
    const app = createSSRApp(App);
    const quanta = createQuanta();
    app.use(quanta);

    const html = await renderToString(app);
    return { html, snapshot: quanta.container.dehydrate() };
}
```

On the client, pass that snapshot to `createQuanta`. It is applied before the first render, so the client's markup matches the server's:

```ts
// entry-client.ts
import { createSSRApp } from 'vue';
import { createQuanta } from '@quantajs/vue';
import App from './App.vue';

const app = createSSRApp(App);
app.use(createQuanta({ snapshot: window.__QUANTA__ }));
app.mount('#app');
```

Never resolve stores against the default container on the server: it is shared by every request. A container created by `createQuanta()` is disposed when the app unmounts; pass `{ container }` to manage one yourself. `provideQuantaContainer(container)` scopes a component subtree to a different container.

## DevTools

```sh
npm install -D @quantajs/devtools
```

```ts
import { enableDevTools } from '@quantajs/vue';

if (import.meta.env.DEV) {
    enableDevTools({ redact: ['token'] });
    import('@quantajs/devtools').then(({ mountDevTools }) => mountDevTools());
}
```

## License

MIT
