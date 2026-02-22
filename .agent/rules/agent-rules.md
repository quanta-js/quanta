---
trigger: always_on
---

# QuantaJS — Agent Rules

## Project Overview

QuantaJS is a **Proxy-based reactive state management library** for JavaScript. It's a monorepo with 3 packages:

- `@quantajs/core` — Framework-agnostic reactivity engine (Proxy-based tracking, computed, watch, persistence)
- `@quantajs/react` — React bindings using `useSyncExternalStore`
- `@quantajs/devtools` — Preact-based devtools overlay (Shadow DOM)

## Monorepo Structure

```
packages/
├── core/src/
│   ├── core/           # Reactivity engine: create-reactive.ts, effect.ts, dependency.ts, create-store.ts
│   ├── state/          # Public API wrappers: reactive.ts, computed.ts, watch.ts
│   ├── persistence/    # State persistence: core.ts, migrations.ts, adapters/
│   ├── services/       # Logger service
│   ├── devtools/       # DevToolsBridge singleton
│   ├── type/           # TypeScript type definitions
│   └── utils/          # flattenStore.ts, deep-trigger.ts, debounce.ts
├── react/src/
│   ├── hooks/          # useQuantaStore, useStore, useCreateStore, useWatch, useComputed
│   ├── components/     # QuantaProvider, QuantaDevTools
│   ├── context/        # QuantaContext
│   └── utils/          # resolve-getters.ts
└── devtools/src/       # Preact UI rendered inside Shadow DOM
```

## Architecture Principles

### Reactivity System
- **Proxy-based**: `createReactive()` wraps objects/arrays in `Proxy` with `get`/`set`/`deleteProperty`/`has`/`ownKeys` traps
- **Dependency Tracking**: `track(target, prop)` called in `get` traps to record which effect depends on which property
- **Trigger Propagation**: `trigger(target, prop)` called in `set` traps to re-run dependent effects
- **Bubble Trigger**: `bubbleTrigger()` walks `parentMap` to notify ancestor objects of nested changes
- **Proxy Cache**: `reactiveMap` (WeakMap) prevents double-wrapping the same object
- **Collections**: `Map` and `Set` have special handling via `createReactiveCollection()`

### Store Pattern
- `createStore(name, options)` creates a named store with state (factory fn), getters (computed), actions (bound to store)
- `flattenStore()` creates a Proxy that exposes state/getters/actions on a single flat namespace (e.g., `store.count` instead of `store.state.count`)
- Stores are registered in a global `storeRegistry` Map
- Actions are bound with `this` = flattened store, enabling `this.count++` inside actions

### React Integration
- Uses `useSyncExternalStore` for concurrent-safe synchronization
- `subscribe` callback invalidates `snapshotRef`, `getSnapshot` rebuilds from store
- Selector branch does shallow equality check to skip unnecessary re-renders
- `QuantaProvider` distributes stores via React Context

## Key Conventions

### Code Style
- TypeScript strict mode, ESNext target
- Prettier + ESLint for formatting/linting
- Vite for building all packages
- pnpm workspaces for monorepo management
- Changesets for versioning/publishing

### Error Handling
- Pervasive try-catch with `logger.error/warn` at every level
- Logger uses configurable log levels (DEBUG, INFO, WARN, ERROR, SILENT)
- Never swallow errors silently — always log then re-throw or skip

### Build & Publish
- `pnpm build` builds all packages
- `pnpm changeset` for version management
- Published to npm under `@quantajs/*` scope
- Core outputs: CJS (`.js`), ESM (`.mjs`), TypeScript declarations (`.d.ts`)


## Development Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm dev              # Dev build all packages
pnpm lint             # Lint all packages
pnpm lint:fix         # Fix lint issues
pnpm format           # Format with prettier
pnpm changeset        # Create a changeset
pnpm version:update   # Update versions from changesets
pnpm publish          # Build + publish to npm
```

## When Making Changes

1. **State/reactivity changes** → Edit `packages/core/src/core/` files
2. **Public API changes** → Update `packages/core/src/state/` wrappers AND `packages/core/src/index.ts` exports
3. **Type changes** → Edit `packages/core/src/type/store-types.ts` or `persistence-types.ts`
4. **React hook changes** → Edit `packages/react/src/hooks/` — always verify with `useSyncExternalStore` behavior
5. **Persistence changes** → Edit `packages/core/src/persistence/` — consider adapter compatibility
6. **Always** verify no circular imports when adding new imports between core modules
7. **Always** ensure changes work with the `flattenStore` Proxy layer (it adds indirection)
