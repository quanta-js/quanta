# @quantajs/react

![Logo](https://raw.githubusercontent.com/quanta-js/quanta/master/assets/quantajs_banner.png)

[![CI](https://github.com/quanta-js/quanta/actions/workflows/ci.yml/badge.svg)](https://github.com/quanta-js/quanta/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/quanta-js/quanta/graph/badge.svg)](https://codecov.io/gh/quanta-js/quanta)

React integration for QuantaJS - A compact, scalable, and developer-friendly state management library for React applications.

## 🚀 Features

✅ **React Optimized** – Built specifically for React applications  
✅ **Performance First** – Uses `useSyncExternalStore` for efficient updates  
✅ **Type-Safe** – Full TypeScript support with proper inference  
✅ **Flexible** – Multiple usage patterns (Provider, Direct, Selectors)  
✅ **QuantaJS Core** – Direct access to reactive, computed, and watch

## 📦 Installation

```sh
npm install @quantajs/react @quantajs/core
# or
yarn add @quantajs/react @quantajs/core
# or
pnpm add @quantajs/react @quantajs/core
```

## ⚡ Quick Start

### Basic Counter Example

```tsx
import React from 'react';
import { createStore, QuantaProvider, useStore } from '@quantajs/react';

// Create store
const counterStore = createStore('counter', {
    state: () => ({ count: 0 }),
    getters: {
        doubleCount: (state) => state.count * 2,
    },
    actions: {
        increment() {
            this.count++;
        },
        decrement() {
            this.count--;
        },
    },
});

// Component
function Counter() {
    const store = useStore();

    return (
        <div>
            <p>Count: {store.count}</p>
            <p>Double: {store.doubleCount}</p>
            <button onClick={() => store.increment()}>+</button>
            <button onClick={() => store.decrement()}>-</button>
        </div>
    );
}

// App
function App() {
    return (
        <QuantaProvider store={counterStore}>
            <Counter />
        </QuantaProvider>
    );
}
```

### With Selectors (Performance)

```tsx
import { useQuantaStore } from '@quantajs/react';

function CounterDisplay() {
    // Only re-render when count changes
    const count = useQuantaStore(counterStore, (store) => store.count);

    return <p>Count: {count}</p>;
}
```

### Component-Scoped Store

```tsx
import { useCreateStore } from '@quantajs/react';

function TodoComponent() {
    const todoStore = useCreateStore(
        'todos',
        () => ({ todos: [] }),
        undefined,
        {
            addTodo(text: string) {
                this.todos.push({ id: Date.now(), text, done: false });
            },
        },
    );

    return (
        <div>
            <button onClick={() => todoStore.addTodo('New task')}>
                Add Todo
            </button>
            <p>Todos: {todoStore.todos.length}</p>
        </div>
    );
}
```

## 🔧 API

### Hooks

- `useQuantaStore(store, selector?)` - Subscribe to store with optional selector
- `useStore(selector?)` - Access store from QuantaProvider context
- `useCreateStore(name, state, getters?, actions?)` - Create component-scoped store

### Components

- `<QuantaProvider store={store}>` - Provide store to child components

### Core Features

- `createStore`, `reactive`, `computed`, `watch` - Re-exported from @quantajs/core

## 📜 License

This project is licensed under the MIT [License](https://github.com/quanta-js/quanta/blob/main/LICENSE) - see the LICENSE file for details.

## 💬 Contributing

We welcome contributions! Feel free to open issues, submit PRs, or suggest improvements.

## ⭐ Support

If you find this library useful, consider giving it a ⭐ star on [GitHub](https://github.com/quanta-js/quanta)!
