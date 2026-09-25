---
'@quantajs/vue': patch
---

`createQuanta()` now disposes the container it created when the app unmounts on Vue 3.3 and 3.4 as well; it relied on `app.onUnmount`, which arrived in Vue 3.5.
