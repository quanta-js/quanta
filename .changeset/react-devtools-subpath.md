---
'@quantajs/react': patch
---

Fix a build failure in every application that does not install the optional
`@quantajs/devtools` peer.

`QuantaDevTools` loads the panel with `import('@quantajs/devtools')`. That
specifier is static, so bundlers resolve it at build time to plan the chunk —
and because the panel was exported from the package barrel, the import was
reachable from the main entry. Any application importing *anything* from
`@quantajs/react` failed:

```
Module not found: Can't resolve '@quantajs/devtools'
```

Not only applications that render the panel. `peerDependenciesMeta.optional`
was set correctly; telling npm not to install the package is precisely what
left the bundler with nothing to resolve.

**The panel moved to a subpath:**

```diff
- import { QuantaDevTools } from '@quantajs/react';
+ import { QuantaDevTools } from '@quantajs/react/devtools';
```

`@quantajs/react` no longer references `@quantajs/devtools` from its main
entry, so it installs and builds with no optional peer present. Only
`@quantajs/react/devtools` needs it.

The barrel keeps a `QuantaDevTools` export so existing code still compiles, but
it renders nothing and warns — **in production builds as well as development**.
This ships as a patch and therefore arrives through a `^2.1.0` range: anyone
who did have `@quantajs/devtools` installed had a working panel before the
upgrade and does not after it, and a development-only warning would be
invisible in the builds where they might notice. The warning names the exact
replacement import and fires once per process.

Also adds `scripts/verify-packaging.mjs`, run in CI: it packs the tarballs,
installs them into a throwaway application with no optional peers, and checks
that `require()` returns the real module, that type declarations exist and
infer, that a bundler build succeeds, and that nothing reachable from the main
entry imports an optional peer. Everything in `examples/` resolves through the
pnpm workspace, where the peers are always present — which is why all three
packaging defects so far (CJS returning `{}`, empty declarations, and this one)
reached a release.
