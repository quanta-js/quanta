# @quantajs/core

![QuantaJS Banner](https://raw.githubusercontent.com/quanta-js/quanta/master/assets/quantajs_banner.png)

[![CI](https://github.com/quanta-js/quanta/actions/workflows/ci.yml/badge.svg)](https://github.com/quanta-js/quanta/actions/workflows/ci.yml)

A fast, framework-agnostic reactivity and store engine for modern JavaScript apps.

## ✨ Why You'll Like It

- ⚡ Fast reactive updates with predictable behavior
- 🧠 Clean API for stores, watchers, computed values, and batching
- 🧱 Scales from tiny apps to complex state graphs
- 💾 Built-in persistence and migrations support
- 🛡️ Strong TypeScript experience

## 📦 Installation

```bash
npm install @quantajs/core
# or
pnpm add @quantajs/core
# or
yarn add @quantajs/core
```

## 🚀 Quick Start

```ts
import { createStore } from '@quantajs/core';

const counter = createStore('counter', {
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

counter.increment();
console.log(counter.count); // 1
console.log(counter.doubled); // 2
```

## 🧩 Core Reactivity

```ts
import { reactive, computed, watch, batchEffects } from '@quantajs/core';

const state = reactive({ a: 1, b: 2 });
const sum = computed(() => state.a + state.b);

watch(
    () => sum.value,
    (next, prev) => {
        console.log('sum changed', prev, '->', next);
    },
);

batchEffects(() => {
    state.a = 10;
    state.b = 20;
});
```

## 💾 Persistence Example

```ts
import { createStore } from '@quantajs/core';
import { createLocalStorageAdapter } from '@quantajs/core/persistence';

const settings = createStore('settings', {
    state: () => ({ theme: 'light' as 'light' | 'dark' }),
    persist: {
        adapter: createLocalStorageAdapter('app-settings'),
        include: ['theme'],
    },
});
```

## 🛠️ Main Exports

- `createStore`, `useStore`
- `reactive`, `computed`, `watch`, `isReactive`, `batchEffects`
- Persistence APIs from `@quantajs/core/persistence`
- `logger`, `createLogger`, `LogLevel`

## 📌 Notes

- Store names must be unique in one runtime.
- Use `store.$destroy()` to remove runtime-created stores.

## 🤝 Contributing

Contributions are welcome. Open an issue or PR if you want to improve docs, APIs, tests, or performance.

## ⭐ Support

If QuantaJS helps your project, please star the repo:
https://github.com/quanta-js/quanta

## 📜 License

MIT
