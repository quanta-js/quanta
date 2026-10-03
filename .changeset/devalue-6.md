---
'@quantajs/astro': patch
---

Update `devalue` to 6. The state snapshot written into the page now escapes unpaired surrogates, so strings containing them reach the browser intact. devalue 6 requires Node 22.17 or later.
