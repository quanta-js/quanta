# @quantajs/lit

[![CI](https://github.com/quanta-js/quanta/actions/workflows/ci.yml/badge.svg)](https://github.com/quanta-js/quanta/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@quantajs/lit.svg)](https://www.npmjs.com/package/@quantajs/lit)

Lit bindings for [`@quantajs/core`](https://www.npmjs.com/package/@quantajs/core): reactive controllers that connect QuantaJS stores to web components. Works with Lit 2 and 3.

**[Documentation](https://quantajs.com/docs/integration/lit-integration)** · [Example app](https://github.com/quanta-js/quanta/tree/master/examples/lit-vite) · [Changelog](https://github.com/quanta-js/quanta/blob/master/packages/lit/CHANGELOG.md)

## Install

```sh
npm install @quantajs/core @quantajs/lit
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

```ts
// todo-app.ts
import { LitElement, html } from 'lit';
import {
    QuantaActionsController,
    QuantaController,
    QuantaValueController,
} from '@quantajs/lit';
import { useTodoStore } from './stores/todos';

export class TodoApp extends LitElement {
    // Updates this element only when `remaining` changes.
    private remaining = new QuantaValueController(
        this,
        useTodoStore,
        (s) => s.remaining,
    );

    // Updates this element on any change to the store.
    private todos = new QuantaController(this, useTodoStore);

    // The store, without subscribing: for calling actions.
    private actions = new QuantaActionsController(this, useTodoStore);

    render() {
        return html`
            <p>${this.remaining.value} left</p>
            <button @click=${() => this.actions.store.add('New todo')}>
                Add
            </button>
            <ul>
                ${this.todos.store.items.map((t) => html`<li>${t.text}</li>`)}
            </ul>
        `;
    }
}
customElements.define('todo-app', TodoApp);
```

No setup is needed in a client-only app: stores resolve against the default container.

## Controllers

| Controller                                                 | Updates the element on  | Use for                                                   |
| ---------------------------------------------------------- | ----------------------- | --------------------------------------------------------- |
| `QuantaValueController(host, definition, selector, opts?)` | What the selector reads | Most elements; read `.value`                              |
| `QuantaController(host, definition, opts?)`                | Any change to the store | Elements that read most of a store; read `.store`         |
| `QuantaActionsController(host, definition, opts?)`         | Nothing                 | Elements that only call actions; read `.store`            |
| `QuantaLocalController(host, definition)`                  | Any change to the store | A store owned by one element, disposed when it is removed |

Create them as class fields, or in the constructor. Subscriptions start when the element connects and end when it disconnects. A local store survives the element being moved in the DOM.

A selector that builds a new object on every run should pass `shallow`, so an unchanged projection does not update:

```ts
import { LitElement } from 'lit';
import { shallow, QuantaValueController } from '@quantajs/lit';
import { useTodoStore } from './stores/todos';

export class TodoSummary extends LitElement {
    private summary = new QuantaValueController(
        this,
        useTodoStore,
        (s) => ({ remaining: s.remaining, total: s.items.length }),
        { equalityFn: shallow },
    );
}
```

## Containers

`provideQuantaContainer(this)` in an element's constructor gives that element's subtree its own container, including elements in its shadow root. It follows the web components context protocol, so `@lit/context` works too: `quantaContainerContext` is the context key.

```ts
import { LitElement } from 'lit';
import { provideQuantaContainer } from '@quantajs/lit';

export class AppRoot extends LitElement {
    constructor() {
        super();
        // Created here and disposed when the element is removed.
        provideQuantaContainer(this);
    }
}
```

Pass `{ container }` to any controller to use a specific container instead. Before an element connects, and during server rendering, controllers resolve against that container or the default one.

## DevTools

```sh
npm install -D @quantajs/devtools
```

```ts
import { enableDevTools } from '@quantajs/lit';

if (import.meta.env.DEV) {
    enableDevTools({ redact: ['token'] });
    import('@quantajs/devtools').then(({ mountDevTools }) => mountDevTools());
}
```

## License

MIT
