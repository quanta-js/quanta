# @quantajs/react

![QuantaJS Banner](https://raw.githubusercontent.com/quanta-js/quanta/master/assets/quantajs_banner.png)

[![CI](https://github.com/quanta-js/quanta/actions/workflows/ci.yml/badge.svg)](https://github.com/quanta-js/quanta/actions/workflows/ci.yml)

React bindings for QuantaJS with stable subscriptions, smart selectors, and ergonomic provider usage.

## ✨ Why You'll Like It

- ⚛️ React-friendly subscription model
- 🎯 Selector hooks for minimal re-renders
- 🧠 Great TypeScript inference and DX
- 🔌 Works directly with QuantaJS core APIs

## 📦 Installation

```bash
npm install @quantajs/react @quantajs/core
# or
pnpm add @quantajs/react @quantajs/core
# or
yarn add @quantajs/react @quantajs/core
```

## 🚀 Quick Start

```tsx
import React from 'react';
import { createStore, QuantaProvider, useStore } from '@quantajs/react';

const counterStore = createStore('counter', {
    state: () => ({ count: 0 }),
    actions: {
        increment() {
            this.count++;
        },
    },
});

function Counter() {
    const counter = useStore('counter');

    return (
        <button onClick={() => counter.increment()}>
            Count: {counter.count}
        </button>
    );
}

export default function App() {
    return (
        <QuantaProvider stores={{ counter: counterStore }}>
            <Counter />
        </QuantaProvider>
    );
}
```

## 🎯 Selector Example

```tsx
import { useQuantaSelector } from '@quantajs/react';

function CounterValue({ store }: { store: any }) {
    const count = useQuantaSelector(store, (s) => s.count);
    return <span>{count}</span>;
}
```

## 🧪 Component-Scoped Store

```tsx
import { useCreateStore } from '@quantajs/react';

function DraftEditor() {
    const draft = useCreateStore(
        'draft-editor',
        () => ({ text: '' }),
        undefined,
        {
            setText(value: string) {
                this.text = value;
            },
        },
    );

    return (
        <textarea
            value={draft.text}
            onChange={(e) => draft.setText(e.currentTarget.value)}
        />
    );
}
```

## 🛠️ Main Exports

- Hooks: `useQuantaStore`, `useQuantaSelector`, `useStore`, `useStoreSelector`, `useCreateStore`, `useWatch`, `useComputed`
- Components: `QuantaProvider`, `QuantaDevTools`
- Core re-exports: `createStore`, `reactive`, `computed`, `watch`, `logger`

## 📌 Notes

- `QuantaProvider` expects `stores={{ [name]: store }}`.
- `useStore(name)` and `useStoreSelector(name, selector)` use that exact key.

## 🤝 Contributing

Contributions are welcome. If you spot docs gaps, edge-case hook behavior, or type improvements, open an issue/PR.

## ⭐ Support

If QuantaJS helps your app, please star the repo:
https://github.com/quanta-js/quanta

## 📜 License

MIT
