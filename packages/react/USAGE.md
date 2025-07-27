# QuantaJS React Usage Guide

This guide demonstrates how to use QuantaJS with React for state management.

## Installation

```bash
pnpm add @quantajs/react @quantajs/core
```

## Basic Setup

### 1. Create a Store

```typescript
import { createStore } from '@quantajs/core';

const counterStore = createStore('counter', {
    state: () => ({
        count: 0,
    }),
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
```

### 2. Use with Provider (Recommended)

```tsx
import React from 'react';
import { QuantaProvider, useStore } from '@quantajs/react';

function App() {
    return (
        <QuantaProvider store={counterStore}>
            <Counter />
        </QuantaProvider>
    );
}

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
```

### 3. Use with Direct Store Reference

```tsx
import { useQuantaStore } from '@quantajs/react';

function Counter() {
    const store = useQuantaStore(counterStore);

    return (
        <div>
            <p>Count: {store.count}</p>
            <button onClick={() => store.increment()}>+</button>
        </div>
    );
}
```

### 4. Use with Selectors

```tsx
function CounterDisplay() {
    // Only re-render when count changes
    const count = useQuantaStore(counterStore, (store) => store.count);

    return <p>Count: {count}</p>;
}

// Or with context
function CounterDisplayWithContext() {
    const count = useStore((store) => store.count);
    return <p>Count: {count}</p>;
}
```

## Advanced Usage

### Component-Scoped Stores

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

    return <div>{/* Use todoStore here */}</div>;
}
```

### Computed Values

```tsx
import { useComputed } from '@quantajs/react';

function StatsComponent() {
    const stats = useComputed(
        store,
        (store) => ({
            total: store.items.length,
            completed: store.items.filter((item) => item.done).length,
        }),
        [store.items], // dependencies
    );

    return (
        <div>
            <p>Total: {stats.total}</p>
            <p>Completed: {stats.completed}</p>
        </div>
    );
}
```

### Watching Changes

```tsx
import { useWatch } from '@quantajs/react';

function LoggingComponent() {
    useWatch(
        store,
        (store) => store.count,
        (newCount) => {
            console.log('Count changed to:', newCount);
        },
    );

    return <div>Check console for count changes</div>;
}
```

## Best Practices

1. **Use selectors** to prevent unnecessary re-renders
2. **Prefer QuantaProvider** for app-level state
3. **Use component stores** for local state that doesn't need to be shared
4. **Keep actions simple** and focused on state mutations
5. **Use computed values** for derived state instead of calculating in components

## API Summary

- `useQuantaStore(store, selector?)` - Subscribe to a store with optional selector
- `useStore(selector?)` - Use store from context with optional selector
- `useCreateStore(name, state, getters?, actions?)` - Create component-scoped store
- `useComputed(store, computeFn, deps?)` - Create computed values
- `useWatch(store, watchFn, callback)` - Watch for changes and run side effects
- `<QuantaProvider store={store}>` - Provide store to child components
