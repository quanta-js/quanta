# QuantaJS

![QuantaJS](./assets/quantajs_banner.png)

[![CI](https://github.com/quanta-js/quanta/actions/workflows/ci.yml/badge.svg)](https://github.com/quanta-js/quanta/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@quantajs/core.svg)](https://www.npmjs.com/package/@quantajs/core)
[![license](https://img.shields.io/npm/l/@quantajs/core.svg)](./LICENSE)

State management with request isolation, async action state and versioned persistence built in. Framework-agnostic, with no runtime dependencies.

**[Documentation](https://quantajs.com)** · [Migrating to 3.0](https://quantajs.com/docs/getting-started/migration)

- **Typed stores without generics.** `defineStore` infers state, getters and actions; `this` inside an action is the fully typed store.
- **Deep reactivity.** Mutate state directly. Reads inside effects, computed values and React selectors are tracked per property.
- **Async actions that report their own state.** Every action has reactive `pending` and `error`, an `abort()`, and an `AbortSignal` at `this.$signal`.
- **Request-scoped containers.** One container per app, per server request or per test, with `dehydrate()` / `hydrate()` for SSR.
- **Persistence with migrations.** Versioned schemas, cross-tab sync, and sanitised loading of untrusted storage.

## Packages

| Package                                     |                                             |
| ------------------------------------------- | ------------------------------------------- |
| [`@quantajs/core`](./packages/core)         | Reactivity, stores, containers, persistence |
| [`@quantajs/react`](./packages/react)       | React hooks and provider                    |
| [`@quantajs/vue`](./packages/vue)           | Vue composables and plugin                  |
| [`@quantajs/svelte`](./packages/svelte)     | Svelte stores and context                   |
| [`@quantajs/lit`](./packages/lit)           | Lit reactive controllers for web components |
| [`@quantajs/astro`](./packages/astro)       | One store across Astro islands, per request |
| [`@quantajs/devtools`](./packages/devtools) | In-page state inspector (optional)          |

## Install

```sh
npm install @quantajs/core
```

`@quantajs/core` works in any JavaScript environment. Add the bindings for your framework: `@quantajs/react`, `@quantajs/vue`, `@quantajs/svelte` or `@quantajs/lit`. For Astro, add `@quantajs/astro` to share one store across islands.

## Quick start

```ts
// stores/cart.ts
import { defineStore } from '@quantajs/core';

export const useCartStore = defineStore('cart', {
    state: () => ({ items: [] as { name: string; price: number }[] }),
    getters: {
        total: (s) => s.items.reduce((sum, item) => sum + item.price, 0),
    },
    actions: {
        add(name: string, price: number) {
            this.items.push({ name, price });
        },
        async checkout() {
            await fetch('/api/checkout', {
                method: 'POST',
                signal: this.$signal,
            });
            this.items = [];
        },
    },
});
```

```tsx
// Cart.tsx
import { useQuantaActions, useQuantaValue } from '@quantajs/react';
import { useCartStore } from './stores/cart';

export function Cart() {
    const total = useQuantaValue(useCartStore, (s) => s.total);
    const pending = useQuantaValue(useCartStore, (s) => s.checkout.pending);
    const error = useQuantaValue(useCartStore, (s) => s.checkout.error);
    const cart = useQuantaActions(useCartStore);

    return (
        <>
            <button
                disabled={pending}
                onClick={() => cart.checkout().catch(() => {})}
            >
                Pay ${total}
            </button>
            {error && <p>{error.message}</p>}
        </>
    );
}
```

`useQuantaValue` re-renders only when what the selector read changes. `useQuantaActions` never re-renders.

The same store works without a framework:

```ts
// main.ts
import { useCartStore } from './stores/cart';

const cart = useCartStore();
cart.subscribe(() => console.log('total', cart.total));
cart.add('Widget', 9.99);
```

## Server rendering

A store definition holds no state, so it is safe at module scope. On the server, resolve it against a container created per request:

```tsx
// app/page.tsx — a Server Component
import { createContainer } from '@quantajs/core';
import { useCartStore } from '../stores/cart';
import { Cart } from '../Cart';
import { Providers } from './providers';

export default function Page() {
    const container = createContainer();
    useCartStore(container).add('Widget', 9.99);

    const snapshot = container.dehydrate();
    container.dispose();

    return (
        <Providers snapshot={snapshot}>
            <Cart />
        </Providers>
    );
}
```

```tsx
// app/providers.tsx
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

See [`examples/nextjs-app`](./examples/nextjs-app) for the complete App Router setup.

## Examples

- [`examples/vanilla`](./examples/vanilla) — no framework, with persistence
- [`examples/react-vite`](./examples/react-vite) — every React hook, async actions, DevTools
- [`examples/nextjs-app`](./examples/nextjs-app) — per-request containers and hydration
- [`examples/vue-vite`](./examples/vue-vite) — every Vue composable, with a concurrent server-render check
- [`examples/svelte-vite`](./examples/svelte-vite) — every Svelte function, with a concurrent server-render check
- [`examples/lit-vite`](./examples/lit-vite) — every Lit controller in web components, with a provided container
- [`examples/astro`](./examples/astro) — React, Vue and Svelte islands sharing one store, with a concurrent-request check

Each is built and verified in CI.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
