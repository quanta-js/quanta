# @quantajs/devtools

![Logo](https://raw.githubusercontent.com/quanta-js/quanta/master/assets/quantajs_banner.png)

[![CI](https://github.com/quanta-js/quanta/actions/workflows/ci.yml/badge.svg)](https://github.com/quanta-js/quanta/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/quanta-js/quanta/graph/badge.svg)](https://codecov.io/gh/quanta-js/quanta)

Developer tools for QuantaJS - A visual debugging interface for inspecting stores, monitoring state changes, and replaying actions in real-time.

## 🚀 Features

✅ **Real-time Store Inspector** – View live state, getters, and actions  
✅ **Action Log** – Track all state mutations with timestamps and payloads  
✅ **Auto-Detection** – Automatically detects development environment  
✅ **Framework Agnostic** – Works with vanilla JS, React, or any framework  
✅ **Modern UI** – Built with Preact and Tailwind CSS v4  
✅ **Lightweight** – Minimal bundle size with tree-shaking support

## 📦 Installation

```sh
npm install @quantajs/devtools @quantajs/core
# or
yarn add @quantajs/devtools @quantajs/core
# or
pnpm add @quantajs/devtools @quantajs/core
```

## ⚡ Quick Start

### Automatic Mounting (Recommended)

The DevTools automatically detect your development environment and mount themselves:

```javascript
import { createStore } from '@quantajs/core';
import { mountDevTools } from '@quantajs/devtools';

// Create your stores
const counterStore = createStore('counter', {
    state: { count: 0 },
    actions: {
        increment() {
            this.count++;
        },
    },
});

// Mount DevTools (auto-detects dev environment)
mountDevTools();
```

### Manual Mounting with Options

```javascript
import { mountDevTools } from '@quantajs/devtools';

// Force show DevTools
mountDevTools({ visible: true });

// Mount to custom element
mountDevTools({
    visible: true,
    target: document.getElementById('devtools-container'),
});
```

### React Integration

```tsx
import React from 'react';
import { QuantaDevTools } from '@quantajs/react';

function App() {
    return (
        <div>
            <YourApp />
            <QuantaDevTools />
        </div>
    );
}
```

## 🎨 Features Overview

### Store Inspector

- **Live State Viewing** – See your store state update in real-time
- **Nested Objects** – Expandable tree view for complex state
- **Getters** – View computed values alongside state
- **Actions** – List of all available actions

### Action Log

- **Action History** – Complete log of all dispatched actions
- **Timestamps** – Track when actions were called
- **Payloads** – View arguments passed to actions
- **Store Context** – See which store each action belongs to

## 🔧 API

### `mountDevTools(options?)`

Mounts the DevTools to your application.

**Options:**

```typescript
interface DevToolsOptions {
    /**
     * Whether to show the DevTools.
     * If not provided, auto-detects development environment.
     */
    visible?: boolean;

    /**
     * Target element to mount into.
     * Defaults to 'body'.
     */
    target?: HTMLElement | string;
}
```

**Returns:** Cleanup function to unmount DevTools

**Example:**

```javascript
const cleanup = mountDevTools({ visible: true });

// Later, unmount DevTools
cleanup();
```

### `DevTools` Component

Preact component that can be manually integrated:

```javascript
import { render } from 'preact';
import { DevTools } from '@quantajs/devtools';

render(<DevTools />, document.body);
```

## 🎯 Usage Tips

### Development Only

Ensure DevTools are only included in development builds:

```javascript
if (process.env.NODE_ENV === 'development') {
    import('@quantajs/devtools').then(({ mountDevTools }) => {
        mountDevTools();
    });
}
```

### With Vite

```javascript
if (import.meta.env.DEV) {
    import('@quantajs/devtools').then(({ mountDevTools }) => {
        mountDevTools();
    });
}
```

### Tree-Shaking

The DevTools automatically detect the environment and won't mount in production, but you can exclude them entirely using your bundler's conditional imports.

## 📜 License

This project is licensed under the MIT [License](https://github.com/quanta-js/quanta/blob/main/LICENSE) - see the LICENSE file for details.

## 💬 Contributing

We welcome contributions! Feel free to open issues, submit PRs, or suggest improvements.

## ⭐ Support

If you find this library useful, consider giving it a ⭐ star on [GitHub](https://github.com/quanta-js/quanta)!
