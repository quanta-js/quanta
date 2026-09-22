# Contributing to QuantaJS

## Setup

```sh
pnpm install
pnpm build
pnpm test
```

Requires Node 20+ and pnpm 10.

## Before opening a pull request

```sh
pnpm lint
pnpm test:types
pnpm test:coverage
pnpm verify:packaging
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
