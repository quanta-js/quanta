---
'@quantajs/core': major
---

Persistence is typed end to end, without `any`:

- `include` and `exclude` accept only the store's state keys.
- `serialize` receives the `PersistedData` envelope it actually encodes; `deserialize` returns `unknown`, which is checked before use.
- `migrations`, `transform.in` and `validator` receive `StoredState` (`Record<string, unknown>`); `transform.out` receives the state slice.
- `PersistenceAdapter` exchanges strings: `read()` returns `string | null`, `write()` takes a `string`. `IndexedDBAdapter.read()` returns `null` for a record that is not a string.
- `PersistedData.storeName` is always set; the unused `checksum` field is removed.
- New exported types: `StoredState` and `PersistenceOperation`.

`validator` now runs on the slice before `transform.out` when saving, so it sees the same state-shaped data on save and load. Previously it received the transformed output on save.
