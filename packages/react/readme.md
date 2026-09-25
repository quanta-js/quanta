# @quantajs/react

[![CI](https://github.com/quanta-js/quanta/actions/workflows/ci.yml/badge.svg)](https://github.com/quanta-js/quanta/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@quantajs/react.svg)](https://www.npmjs.com/package/@quantajs/react)

React bindings for [`@quantajs/core`](https://www.npmjs.com/package/@quantajs/core). Built on `useSyncExternalStore`; works with React 18 and 19, StrictMode, SSR and the Next.js App Router.

**[Documentation](https://quantajs.com/docs/integration/react-integration)** · [Example app](https://github.com/quanta-js/quanta/tree/master/examples/react-vite) · [Changelog](https://github.com/quanta-js/quanta/blob/master/packages/react/CHANGELOG.md)

## Install

```sh
npm install @quantajs/core @quantajs/react
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

```tsx
// Todos.tsx
import { useQuanta, useQuantaActions, useQuantaValue } from '@quantajs/react';
import { useTodoStore } from './stores/todos';

// Re-renders only when `remaining` changes.
export function Remaining() {
    const remaining = useQuantaValue(useTodoStore, (s) => s.remaining);
    return <p>{remaining} left</p>;
}

// Never re-renders on store changes.
export function AddButton() {
    const todos = useQuantaActions(useTodoStore);
    return <button onClick={() => todos.add('New todo')}>Add</button>;
}

// Re-renders on any change to the store.
export function List() {
    const todos = useQuanta(useTodoStore);
    return (
        <ul>
            {todos.items.map((t, i) => (
                <li key={i}>{t.text}</li>
            ))}
        </ul>
    );
}
```

No provider is needed in a client-only app. Stores resolve against the nearest `<QuantaProvider>`'s container, or the ambient one.

## Hooks

| Hook                                             | Subscribes to           | Use for                                                      |
| ------------------------------------------------ | ----------------------- | ------------------------------------------------------------ |
| `useQuantaValue(definition, selector, options?)` | What the selector reads | Most components                                              |
| `useQuanta(definition)`                          | The whole store         | Small stores, or components that read most of it             |
| `useQuantaActions(definition)`                   | Nothing                 | Components that only call actions                            |
| `useLocalStore(definition)`                      | The whole store         | A store instance owned by one component, disposed on unmount |
| `useComputed(store, fn, options?)`               | What `fn` reads         | A cached derivation scoped to a component                    |
| `useWatch(store, source, callback, options?)`    | What `source` reads     | Side effects on change                                       |

Selectors run on render and whenever state they read changes, so keep them cheap. Define an expensive selector outside the component (or wrap it in `useCallback`), or use `useComputed` for a cached derivation.

`useQuantaStore(store)` and `useQuantaSelector(store, selector)` are the same as `useQuanta` and `useQuantaValue` but take a resolved store instead of a definition.

A selector that builds a new object or array on every call should pass `shallow` so unchanged projections do not re-render:

```tsx
import { shallow, useQuantaValue } from '@quantajs/react';
import { useTodoStore } from './stores/todos';

export function Summary() {
    const { remaining, total } = useQuantaValue(
        useTodoStore,
        (s) => ({ remaining: s.remaining, total: s.items.length }),
        { equalityFn: shallow },
    );
    return (
        <p>
            {remaining} of {total} left
        </p>
    );
}
```

## Async action state

```tsx
import { defineStore } from '@quantajs/core';
import { useQuantaActions, useQuantaValue } from '@quantajs/react';

const useProfile = defineStore('profile', {
    state: () => ({ name: '' }),
    actions: {
        async load() {
            const res = await fetch('/api/me', { signal: this.$signal });
            this.name = (await res.json()).name;
        },
    },
});

export function Profile() {
    const profile = useQuantaActions(useProfile);
    const pending = useQuantaValue(useProfile, (s) => s.load.pending);
    const error = useQuantaValue(useProfile, (s) => s.load.error);

    if (pending)
        return <button onClick={() => profile.load.abort()}>Cancel</button>;
    return (
        <>
            <button onClick={() => profile.load().catch(() => {})}>Load</button>
            {error && <p>{error.message}</p>}
        </>
    );
}
```

## Server rendering

`<QuantaProvider>` takes an optional `container` and an optional `snapshot` from `container.dehydrate()`. The snapshot is applied before the first render, so the client's markup matches the server's.

```tsx
'use client';

import type { ReactNode } from 'react';
import type { ContainerSnapshot } from '@quantajs/core';
import { QuantaProvider } from '@quantajs/react';

export function Providers(props: {
    snapshot: ContainerSnapshot;
    children: ReactNode;
}) {
    return (
        <QuantaProvider snapshot={props.snapshot}>
            {props.children}
        </QuantaProvider>
    );
}
```

On the server, create a container per request, resolve stores against it, and pass its snapshot down. Never resolve a store against the ambient container on the server: it is shared across requests. See the [Next.js guide](https://quantajs.com/docs/integration/nextjs-integration) and [`examples/nextjs-app`](https://github.com/quanta-js/quanta/tree/master/examples/nextjs-app).

## DevTools

```sh
npm install -D @quantajs/devtools
```

```tsx
import { QuantaDevTools } from '@quantajs/react/devtools';

export function DevPanel() {
    return <QuantaDevTools redact={['token']} />;
}
```

The panel is loaded lazily and mounts only in development builds unless `visible` is set. `@quantajs/react` itself never imports `@quantajs/devtools`.

## License

MIT
