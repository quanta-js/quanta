# QuantaJS — vanilla example

`@quantajs/core` has no framework dependency. This example proves it by using
the library directly against the DOM, and doubles as the reference for how
to do that in your own project.

## Run it

```sh
pnpm install
pnpm --filter example-vanilla dev
```

## What's in here

`index.html` + `src/main.ts` — a small page with three sections:

- **Two counters**, each resolved from the same `defineStore` definition
  against a *different* `createContainer()`. Bumping one never touches the
  other — containers are the unit of isolation, and you get it without any
  provider or framework glue.
- **Todos** — getters, an async action (`seed()`), and `watch()` observing
  the action's reactive `pending` flag. Configured with
  `persist: { adapter: new LocalStorageAdapter(...) } }`, so the list
  survives a reload.
- **Reactivity primitives** — `reactive`, `computed`, `watch(..., { deep:
  true })`, `effect`, `batchEffects` and `effectScope` used with no store at
  all. This is the layer `defineStore` itself is built on.

## Verifying the package, not just the demo

`verify-esm.mjs` and `verify-cjs.cjs` are a separate concern from the
browser demo above: they `import`/`require()` the **built** `dist` output
and assert the real exports exist and behave correctly. Run them after
building the package:

```sh
pnpm --filter @quantajs/core build
pnpm --filter example-vanilla verify
```

These two scripts are the regression test for packaging bugs that source-only
unit tests structurally cannot see — e.g. a CJS entry point that resolves to
an empty object, or a build that silently drops an export.
