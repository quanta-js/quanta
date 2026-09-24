# QuantaJS — Svelte + Vite example

## Run it

```sh
pnpm install
pnpm --filter example-svelte-vite dev
```

## What's in here

- `src/stores.ts`: a todo store with a getter and an async `load` action, and a counter store.
- Every `@quantajs/svelte` function: `useQuantaValue` (with `shallow` for a projection, and an action's `pending` state), `useQuanta`, `useQuantaActions`, and `useLocalStore` in two components that each get their own store.
- `src/entry-server.ts`: renders the app for one request in a container of its own and returns the snapshot a client would hydrate from.

## What CI checks

`pnpm build` builds the client and the server entry against the built packages. `pnpm verify` then renders two requests at the same time, the first to start finishing last, and fails if either page shows the other's state.
