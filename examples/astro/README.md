# QuantaJS — Astro example

## Run it

```sh
pnpm install
pnpm --filter example-astro dev
```

Open `/?user=you`, press "add" in any island, and watch the others follow.

## What's in here

- `astro.config.mjs`: the `@quantajs/astro` integration, with the React, Vue and Svelte renderers and the Node adapter.
- `src/stores.ts`: one cart store, written once in plain TypeScript.
- `src/pages/index.astro`: rendered per request. Its frontmatter loads the cart for `?user=` without passing a container; the request's container is used.
- `src/pages/static.astro`: prerendered at build time.
- `src/components/`: a React, a Vue and a Svelte island, each using its own binding against the same store. `<ClientRouter />` in the layout shows the state following view transitions.

## What CI checks

`pnpm build` builds the server and client. `pnpm verify` starts the server, requests the page for two users at once (the first to start finishing last), and fails if any island, snapshot or cookie on one page shows the other user. It also checks the prerendered page carries its state, and that the browser loads a single copy of `@quantajs/core`, which is what lets the islands share state.
