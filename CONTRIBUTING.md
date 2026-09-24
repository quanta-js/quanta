# Contributing to QuantaJS

## Finding something to work on

Issues labelled [`good first issue`](https://github.com/quanta-js/quanta/labels/good%20first%20issue) are self-contained, and each one says where to start and what done looks like. Comment on an issue to pick it up, so two people don't work on the same thing. For a larger change, open an issue first so we can agree on the approach before you write the code.

Documentation lives in [quanta-js/quanta-docs](https://github.com/quanta-js/quanta-docs), which has [good first issues](https://github.com/quanta-js/quanta-docs/labels/good%20first%20issue) too. Package readmes stay short; guides and API reference belong on the docs site.

## Setup

```sh
pnpm install
pnpm build
pnpm test
```

Requires Node 20+ and pnpm 10.

## Project layout

| Path                | Contents                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `packages/core`     | `@quantajs/core`: reactivity, stores, containers and persistence, with no runtime dependencies |
| `packages/react`    | `@quantajs/react`: hooks and the provider                                                      |
| `packages/devtools` | `@quantajs/devtools`: the in-page inspector, built with Preact in a shadow root                |
| `examples/`         | Vanilla, React + Vite and Next.js apps, built in CI against the packages                       |
| `benchmarks/`       | Performance scenarios; CI fails if one gets more than 30% slower than `master`                 |
| `scripts/`          | Packaging and readme snippet checks                                                            |

Tests sit next to the code in `src/__tests__/`. Run one file with `pnpm vitest run <path>`. A test that needs a DOM starts with a `@vitest-environment happy-dom` docblock.

## Before opening a pull request

```sh
pnpm lint
pnpm test:types
pnpm test:coverage
pnpm verify:packaging
pnpm check:size
```

- Branch from `master`.
- Add tests for behaviour changes.
- Add a changeset for anything that affects a published package: `pnpm changeset`.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages, e.g. `fix(core): …`.
- Code style is enforced by Prettier and ESLint (`eslint.config.mjs`).

## Reporting bugs

Open an issue with a minimal reproduction. Report security issues privately as described in [SECURITY.md](./SECURITY.md).

## Code of Conduct

This project follows the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the MIT License.
