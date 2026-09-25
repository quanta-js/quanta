# QuantaJS — Lit + Vite example

## Run it

```sh
pnpm install
pnpm --filter example-lit-vite dev
```

## What's in here

- `src/stores.ts`: a todo store with a getter and an async `load` action, and a counter store.
- `src/main.ts`: web components using every `@quantajs/lit` controller. `<todo-app>` calls `provideQuantaContainer(this)`, so every element below it shares one container. `QuantaValueController` renders a `shallow` projection and an action's `pending` state, `QuantaController` the list, `QuantaActionsController` the buttons, and two `<local-counter>` elements each own a `QuantaLocalController` store.

## What CI checks

`pnpm build` type-checks the app, which proves the controllers infer store and selection types, then bundles it. `pnpm verify` checks every element reached the bundle.
