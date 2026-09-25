# @quantajs/devtools

[![CI](https://github.com/quanta-js/quanta/actions/workflows/ci.yml/badge.svg)](https://github.com/quanta-js/quanta/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@quantajs/devtools.svg)](https://www.npmjs.com/package/@quantajs/devtools)

An in-page inspector for [`@quantajs/core`](https://www.npmjs.com/package/@quantajs/core) stores: live state and an action log. Renders inside a shadow root, so it does not touch your page's styles.

**[Documentation](https://quantajs.com/docs/guides/devtools)** · [Changelog](https://github.com/quanta-js/quanta/blob/master/packages/devtools/CHANGELOG.md)

## Install

```sh
npm install -D @quantajs/devtools
```

## React

Use the panel from [`@quantajs/react`](https://www.npmjs.com/package/@quantajs/react):

```tsx
import { QuantaDevTools } from '@quantajs/react/devtools';

export function DevPanel() {
    return <QuantaDevTools redact={['token']} />;
}
```

## Any other setup

```ts
import { enableDevTools } from '@quantajs/core';
import { mountDevTools } from '@quantajs/devtools';

enableDevTools({ redact: ['token'] });
const unmount = mountDevTools({ visible: true });
```

`mountDevTools` options:

| Option    | Default                 |                                        |
| --------- | ----------------------- | -------------------------------------- |
| `visible` | development builds only | Force the panel on or off              |
| `target`  | `'body'`                | Element or selector to mount into      |
| `onError` | —                       | Called when the target cannot be found |

## Security

DevTools sees every store's state and every action argument, and exposes them to scripts on the page. Enable it in development only, and list sensitive paths in `redact`.

## License

MIT
