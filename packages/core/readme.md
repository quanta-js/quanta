# @quantajs/core

[![CI](https://github.com/quanta-js/quanta/actions/workflows/ci.yml/badge.svg)](https://github.com/quanta-js/quanta/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@quantajs/core.svg)](https://www.npmjs.com/package/@quantajs/core)

Framework-agnostic reactive stores for JavaScript and TypeScript: typed stores, deep reactivity, async action state, request-scoped containers and persistence. No runtime dependencies.

For React, add [`@quantajs/react`](https://www.npmjs.com/package/@quantajs/react).

## Install

```sh
npm install @quantajs/core
```

## Define a store

```ts
import { defineStore } from '@quantajs/core';

export const useCounterStore = defineStore('counter', {
    state: () => ({ count: 0 }),
    getters: {
        doubled: (s) => s.count * 2,
    },
    actions: {
        increment() {
            this.count++;
        },
    },
});

const counter = useCounterStore();
counter.increment();
counter.count; // 1
counter.doubled; // 2
```

`defineStore` returns a definition, not an instance. Calling it resolves the instance in a container (the ambient one by default), so the definition is safe to share at module scope. State, getters and actions are flattened onto the store and fully typed.

## Store API

```ts
import { defineStore } from '@quantajs/core';

const useSettings = defineStore('settings', {
    state: () => ({ theme: 'light' as 'light' | 'dark', fontSize: 14 }),
});
const settings = useSettings();

const stop = settings.subscribe(() => console.log('changed'));
settings.$patch({ theme: 'dark', fontSize: 16 }); // one notification
settings.$patch((s) => {
    s.fontSize += 2;
});
settings.$reset(); // back to the state() factory
const snapshot = settings.$dehydrate(); // plain, serialisable copy
settings.$hydrate(snapshot);
stop();
settings.$destroy();
```

## Async actions

Every action carries reactive `pending` and `error`, plus `abort()`. Inside an action, `this.$signal` is an `AbortSignal` for the current call.

```ts
import { defineStore } from '@quantajs/core';

const useUser = defineStore('user', {
    state: () => ({ name: '' }),
    actions: {
        async load(id: string) {
            const res = await fetch(`/api/users/${id}`, {
                signal: this.$signal,
            });
            this.name = (await res.json()).name;
        },
    },
});

const user = useUser();
const request = user.load('42');
user.load.pending; // true
user.load.abort(); // rejects the in-flight call
await request.catch(() => {});
user.load.error; // the rejection, or null
```

Read `this.$signal` before the first `await`: it refers to the current call only while the action is running synchronously.

## Containers

A container is an isolated set of store instances: one per app, per server request, or per test.

```ts
import { createContainer, defineStore } from '@quantajs/core';

const useCounter = defineStore('counter', { state: () => ({ count: 0 }) });

// Server: one container per request
const container = createContainer();
useCounter(container).count = 7;
const snapshot = container.dehydrate();
container.dispose();

// Client: apply the server's state
const client = createContainer();
client.hydrate(snapshot);
useCounter(client).count; // 7
```

On a server, always pass a container. The ambient container is shared by every request in the process.

## Reactivity

The primitives stores are built on, usable on their own:

```ts
import {
    batchEffects,
    computed,
    effect,
    reactive,
    watch,
} from '@quantajs/core';

const state = reactive({ a: 1, b: 2, items: [] as number[] });

const sum = computed(() => state.a + state.b);

const stop = watch(
    () => sum.value,
    (next, prev) => console.log(prev, '->', next),
);

const runner = effect(() => console.log('items:', state.items.length));

batchEffects(() => {
    state.a = 10;
    state.b = 20; // dependents run once
});

stop();
runner.stop();
```

Also exported: `readonly`, `shallowReactive`, `shallowReadonly`, `effectScope`, `untrack`, `toRaw`, `markRaw`, `isReactive`, `isReadonly`, `isProxy`.

## Persistence

```ts
import { defineStore, LocalStorageAdapter } from '@quantajs/core';

const usePrefs = defineStore('prefs', {
    state: () => ({ theme: 'light', token: '' }),
    persist: {
        adapter: new LocalStorageAdapter('app-prefs'),
        include: ['theme'],
        version: 2,
        migrations: {
            2: (data) => ({ ...data, theme: data.darkMode ? 'dark' : 'light' }),
        },
    },
});

const prefs = usePrefs();
await prefs.$hydrated; // resolves once stored state has been applied
```

Adapters: `LocalStorageAdapter`, `SessionStorageAdapter`, `IndexedDBAdapter`, or any object implementing `PersistenceAdapter`. The storage adapters are SSR-safe and do nothing when there is no `window`.

Other options: `exclude`, `debounceMs`, `validator`, `onError`, `serialize` / `deserialize`, `transform`. Stored data is treated as untrusted: payloads from a newer version are refused, and prototype-pollution keys are stripped.

## DevTools

```ts
import { enableDevTools } from '@quantajs/core';

if (process.env.NODE_ENV !== 'production') {
    enableDevTools({ redact: ['token'] });
}
```

Then mount the panel from [`@quantajs/devtools`](https://www.npmjs.com/package/@quantajs/devtools). DevTools is off by default because it exposes all state and action arguments to the page.

## License

MIT

## Cookie persistence

See [CookieAdapter options and limitations](./COOKIE_PERSISTENCE.md) for storing small preferences in cookies.
