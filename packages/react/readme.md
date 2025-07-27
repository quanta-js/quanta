# @quantajs/react

React integration for QuantaJS - A compact, scalable, and developer-friendly state management library for React applications.

## Installation

```bash
npm install @quantajs/react @quantajs/core
```

## Quick Start

### 1. Create a Store

```typescript
import { createStore } from '@quantajs/react';

// Define your store
const useCounterStore = () =>
    createStore(
        'counter',
        // State
        () => ({
            count: 0,
            name: 'Counter',
        }),
        // Getters
        {
            doubleCount: (state) => state.count * 2,
            displayName: (state) => `${state.name}: ${state.count}`,
        },
        // Actions
        {
            increment() {
                this.count++;
            },
            decrement() {
                this.count--;
            },
            setCount(value: number) {
                this.count = value;
            },
            setName(name: string) {
                this.name = name;
            },
        },
    );
```

### 2. Use with QuantaProvider (Recommended)

```tsx
import React from 'react';
import { QuantaProvider, useStore } from '@quantajs/react';
import { createStore } from '@quantajs/core';

// Create your store
const counterStore = createStore('counter', {
    state: () => ({
        count: 0,
    }),
    actions: {
        increment() {
            this.count++;
        },
    },
});

// App component
function App() {
    return (
        <QuantaProvider store={counterStore}>
            <Counter />
        </QuantaProvider>
    );
}

// Component using the store
function Counter() {
    const store = useStore();

    return (
        <div>
            <p>Count: {store.count}</p>
            <button onClick={() => store.increment()}>Increment</button>
        </div>
    );
}
```

### 3. Use with Direct Store Instance

```tsx
import React from 'react';
import { useQuantaStore } from '@quantajs/react';
import { createStore } from '@quantajs/core';

const counterStore = createStore('counter', {
    state: () => ({ count: 0 }),
    actions: {
        increment() {
            this.count++;
        },
    },
});

function Counter() {
    const store = useQuantaStore(counterStore);

    return (
        <div>
            <p>Count: {store.count}</p>
            <button onClick={() => store.increment()}>Increment</button>
        </div>
    );
}
```

## API Reference

### Hooks

#### `useQuantaStore(store, selector?)`

Subscribe to a QuantaJS store and get reactive updates.

```tsx
// Use entire store
const store = useQuantaStore(myStore);

// Use with selector for specific values
const count = useQuantaStore(myStore, (store) => store.count);
```

#### `useStore(selector?)`

Access the store from the nearest `QuantaProvider`.

```tsx
// Use entire store
const store = useStore();

// Use with selector
const count = useStore((store) => store.count);
```

#### `useCreateStore(name, state, getters?, actions?)`

Create a store instance within a component (useful for component-scoped state).

```tsx
function MyComponent() {
    const store = useCreateStore(
        'component-store',
        () => ({ value: 0 }),
        undefined,
        {
            increment() {
                this.value++;
            },
        },
    );

    return <div>{store.value}</div>;
}
```

#### `useComputed(store, computeFn, deps?)`

Create computed values that depend on store state.

```tsx
function MyComponent() {
    const doubleCount = useComputed(
        store,
        (store) => store.count * 2,
        [store.count], // optional dependencies
    );

    return <div>Double: {doubleCount}</div>;
}
```

#### `useWatch(store, watchFn, callback, options?)`

Watch for changes in store values and execute side effects.

```tsx
function MyComponent() {
    useWatch(
        store,
        (store) => store.count,
        (newCount, oldCount) => {
            console.log(`Count changed from ${oldCount} to ${newCount}`);
        },
        { immediate: true },
    );

    return <div>Watching count changes...</div>;
}
```

### Components

#### `<QuantaProvider store={store}>`

Provider component that makes a QuantaJS store available to all child components.

```tsx
<QuantaProvider store={myStore}>
    <App />
</QuantaProvider>
```

### Context

#### `useQuantaContext()`

Access the QuantaJS context directly (used internally by `useStore`).

```tsx
const { store } = useQuantaContext();
```

## Best Practices

1. **Use QuantaProvider for app-level state**: Wrap your app with `QuantaProvider` for global state management.

2. **Use selectors for performance**: When you only need specific values from the store, use selectors to prevent unnecessary re-renders.

3. **Component-scoped stores**: Use `useCreateStore` for state that's only relevant to a specific component tree.

4. **Computed values**: Use `useComputed` for derived state that depends on store values.

5. **Side effects**: Use `useWatch` for side effects that should trigger when store values change.

## Examples

### Todo App

```tsx
import React, { useState } from 'react';
import { QuantaProvider, useStore } from '@quantajs/react';
import { createStore } from '@quantajs/core';

interface Todo {
    id: number;
    text: string;
    completed: boolean;
}

const todoStore = createStore('todos', {
    state: () => ({
        todos: [] as Todo[],
        filter: 'all' as 'all' | 'active' | 'completed',
    }),
    getters: {
        filteredTodos: (state) => {
            switch (state.filter) {
                case 'active':
                    return state.todos.filter((todo) => !todo.completed);
                case 'completed':
                    return state.todos.filter((todo) => todo.completed);
                default:
                    return state.todos;
            }
        },
        activeCount: (state) =>
            state.todos.filter((todo) => !todo.completed).length,
    },
    actions: {
        addTodo(text: string) {
            this.todos.push({
                id: Date.now(),
                text,
                completed: false,
            });
        },
        toggleTodo(id: number) {
            const todo = this.todos.find((t) => t.id === id);
            if (todo) {
                todo.completed = !todo.completed;
            }
        },
        setFilter(filter: 'all' | 'active' | 'completed') {
            this.filter = filter;
        },
    },
});

function TodoApp() {
    return (
        <QuantaProvider store={todoStore}>
            <div>
                <TodoInput />
                <TodoList />
                <TodoFilters />
            </div>
        </QuantaProvider>
    );
}

function TodoInput() {
    const [text, setText] = useState('');
    const { addTodo } = useStore();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (text.trim()) {
            addTodo(text.trim());
            setText('');
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a todo..."
            />
            <button type="submit">Add</button>
        </form>
    );
}

function TodoList() {
    const filteredTodos = useStore((store) => store.filteredTodos);
    const { toggleTodo } = useStore();

    return (
        <ul>
            {filteredTodos.map((todo) => (
                <li key={todo.id}>
                    <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => toggleTodo(todo.id)}
                    />
                    <span
                        style={{
                            textDecoration: todo.completed
                                ? 'line-through'
                                : 'none',
                        }}
                    >
                        {todo.text}
                    </span>
                </li>
            ))}
        </ul>
    );
}

function TodoFilters() {
    const filter = useStore((store) => store.filter);
    const activeCount = useStore((store) => store.activeCount);
    const { setFilter } = useStore();

    return (
        <div>
            <span>{activeCount} items left</span>
            <button
                onClick={() => setFilter('all')}
                style={{ fontWeight: filter === 'all' ? 'bold' : 'normal' }}
            >
                All
            </button>
            <button
                onClick={() => setFilter('active')}
                style={{ fontWeight: filter === 'active' ? 'bold' : 'normal' }}
            >
                Active
            </button>
            <button
                onClick={() => setFilter('completed')}
                style={{
                    fontWeight: filter === 'completed' ? 'bold' : 'normal',
                }}
            >
                Completed
            </button>
        </div>
    );
}

export default TodoApp;
```
