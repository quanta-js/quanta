# Cookie persistence

Use `CookieAdapter` for small serialized state that the browser should send with requests:

```ts
import { CookieAdapter } from '@quantajs/core';

const adapter = new CookieAdapter('preferences', {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'Lax',
    secure: true,
});
```

Pass this adapter as `persist.adapter`, like the other built-in adapters. Defaults are `path: '/'`, a 30-day `maxAge` in seconds, `sameSite: 'Lax'`, `secure: false`, and no domain attribute (host-only). `SameSite=None` requires `secure: true`; secure cookies require HTTPS. Removal uses the same path and domain with `Max-Age=0`. Avoid using the same key at multiple paths or domains: `document.cookie` does not expose that scope to readers.

Keys and values are URI-encoded. Reads return the decoded serialized string (or `null`), leaving persistence deserialization to the manager. Writes above a conservative 4096-byte limit, including encoded key/value and attributes, are skipped with a development warning. Serialization errors, invalid attributes and thrown browser access errors also warn only in development. Browser policies can silently reject cookies, and this adapter cannot guarantee acceptance.

Without `document`, reads return `null` and writes/removals do nothing. This adapter does not read incoming HTTP request headers on the server; applications must handle request cookies and hydration themselves. Cookie values are JavaScript-readable and this adapter cannot create HttpOnly cookies. Do not persist secrets or authentication tokens with it. Cookies have no native storage event, so there is no `subscribe` method or automatic cross-tab synchronization.
