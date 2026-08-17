# QuantaJS — Next.js App Router example

The one scenario nothing else in this repo validates: SSR through a real
bundler, not `happy-dom`.

## Run it

```sh
pnpm install
pnpm --filter "./packages/**" build
pnpm --filter example-nextjs-app dev
```

## The round trip

1. **`app/page.tsx`** (Server Component) creates a container **per request**
   with `createContainer()` — never the ambient one, which is shared across
   every request this Node process serves. It resolves the store, sets some
   state (standing in for a DB/session read), then calls
   `container.dehydrate()` and disposes the container.
2. The resulting snapshot is passed as a prop into **`app/providers.tsx`**
   (`'use client'`), which hands it to `<QuantaProvider snapshot={...}>`.
   The provider creates a fresh container on the client and applies the
   snapshot synchronously during the first render — before children mount —
   so the client's first paint matches the server's HTML.
3. **`Counter`**, also in `providers.tsx`, reads and mutates the store with
   `useQuanta` like any client-side store — the fact that its initial value
   came from the server is invisible to it.

## Verifying the build

```sh
pnpm --filter example-nextjs-app build
pnpm --filter example-nextjs-app verify
```

`next build` succeeding is itself most of the test: it's the only place in
this repo that runs the SSR/hydration code through Next's real App Router
bundler rather than `happy-dom`. `verify-build.mjs` additionally checks
`.next/server` for a client-reference-manifest, confirming Next actually
recognized the `'use client'` boundary in `providers.tsx` rather than
silently rendering it as a Server Component.

A `renderToString`/`hydrateRoot` test covering the same dehydrate/hydrate
round trip — without a Next.js dependency — lives in
`packages/react/src/__tests__/ssr.test.tsx` for fast day-to-day feedback;
this example exists for what that test structurally can't reach: the RSC
boundary and real bundler behavior.
