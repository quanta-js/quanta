# QuantaJS — React + Vite example

## Run it

```sh
pnpm install
pnpm --filter example-react-vite dev
```

## What's in here

`src/main.tsx` renders under `<StrictMode>` (kept on permanently — it's what
would have caught a hook that breaks on React's development-only
mount/unmount/remount cycle) with an **explicit** `createContainer()` passed
to `<QuantaProvider>`, and `<QuantaDevTools>` mounted alongside the app.

`src/App.tsx` exercises every React hook the package ships:

| Hook | Where |
|---|---|
| `useQuanta` | `CartSummary`, `CheckoutButton` — full store, subscribed |
| `useQuantaValue` | `ItemCount` — a selector, fine-grained subscription |
| `useQuantaActions` | `AddItemForm`, `TaxTotal` — resolves without subscribing |
| `useComputed` | `TaxTotal` — a cached derivation |
| `useWatch` | `CartToast` — a side effect on a watched value |
| `useLocalStore` | `Wizard` (rendered twice) — container scoped to the component instance |

`CheckoutButton` calls a fake-network async action to drive its `pending`,
`error` and `abort()` state in a real component, not just a unit test.

## Verifying the build, not just the demo

`verify-build.mjs` runs after `vite build` and inspects `dist/` directly: it
asserts the lazily-loaded `./Heavy` panel and `@quantajs/devtools` (which
pulls in Preact) each land in their own chunk, separate from the main entry.
This is the regression test for `@quantajs/react` accidentally bundling
Preact into every consumer instead of code-splitting it — a build-shape bug
no unit test running against `src/` can see.

```sh
pnpm --filter "./packages/**" build
pnpm --filter example-react-vite build
pnpm --filter example-react-vite verify
```
