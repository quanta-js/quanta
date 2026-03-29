# @quantajs/devtools

![QuantaJS Banner](https://raw.githubusercontent.com/quanta-js/quanta/master/assets/quantajs_banner.png)

[![CI](https://github.com/quanta-js/quanta/actions/workflows/ci.yml/badge.svg)](https://github.com/quanta-js/quanta/actions/workflows/ci.yml)

Powerful DevTools for QuantaJS with real-time state inspection and action/event tracking.

## ✨ Why You'll Like It

- 🔍 Live store state explorer
- 🧾 Action timeline with payload inspection
- 🛡️ Safe serialization for complex/circular objects
- 🔌 Simple mount API for any app setup

## 📦 Installation

```bash
npm install @quantajs/devtools @quantajs/core
# or
pnpm add @quantajs/devtools @quantajs/core
# or
yarn add @quantajs/devtools @quantajs/core
```

## 🚀 Quick Start

```ts
import { createStore } from '@quantajs/core';
import { mountDevTools } from '@quantajs/devtools';

createStore('counter', {
    state: () => ({ count: 0 }),
    actions: {
        increment() {
            this.count++;
        },
    },
});

const cleanup = mountDevTools(); // auto-detects dev mode
```

## ⚙️ Mount with Options

```ts
import { mountDevTools } from '@quantajs/devtools';

mountDevTools({ visible: true });
mountDevTools({ target: '#devtools-root' });
mountDevTools({
    target: document.body,
    onError(error) {
        console.warn('DevTools mount issue:', error.message);
    },
});
```

### `DevToolsOptions`

```ts
interface DevToolsOptions {
    visible?: boolean;
    target?: HTMLElement | string;
    onError?: (error: Error) => void;
}
```

## 🛠️ Exports

- `mountDevTools(options?)`
- `DevTools` (Preact component)

## ⚛️ React Users

If you use `@quantajs/react`, you can render `QuantaDevTools` directly from that package.

## 🤝 Contributing

Contributions are welcome. Share bug reports, DX feedback, and UI/UX improvements through issues and PRs.

## ⭐ Support

If QuantaJS helps your team, please star the repo:
https://github.com/quanta-js/quanta

## 📜 License

MIT
