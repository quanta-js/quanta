---
'@quantajs/react': patch
---

StrictMode and `useLocalStore` fixes:

- `<QuantaProvider>` without a `container`, and `useLocalStore`, no longer break under React StrictMode. StrictMode's simulated unmount in development disposed the container the component went on using, so the first update threw or was ignored. Disposal now happens a tick after a real unmount.
- `useLocalStore` now re-renders the component when its store changes, like `useQuanta`. It previously returned the store without subscribing to it.
