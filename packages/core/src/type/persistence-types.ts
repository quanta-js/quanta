/**
 * A persisted slice as it is stored: after `transform.out`, and for data
 * written by an older version, before migration. Anything read back is
 * untrusted, so its values are `unknown` until a validator has checked them.
 */
export type StoredState = Record<string, unknown>;

/** The operation that failed, as reported to `onError`. */
export type PersistenceOperation = 'read' | 'write' | 'remove' | 'watch-setup';

/**
 * Where a store's state is kept. Adapters store the string `serialize`
 * produced and hand it back from `read`.
 */
export interface PersistenceAdapter {
    readonly key: string;
    read(): string | null | Promise<string | null>;
    write(data: string): void | Promise<void>;
    remove(): void | Promise<void>;
    /**
     * Report writes made elsewhere, such as in another tab, with `null` when
     * the data was removed. Returns a function that stops the updates.
     */
    subscribe?(callback: (data: string | null) => void): () => void;
}

/** The envelope written around a persisted slice. */
export interface PersistedData<D = StoredState> {
    data: D;
    /** The store's `persist.version` when this was written. */
    version: number;
    /** When this was written, in milliseconds since the epoch. */
    timestamp: number;
    storeName: string;
}

export interface PersistenceConfig<S extends object = StoredState> {
    adapter: PersistenceAdapter;
    /** Keys to persist. Without it the whole state is persisted. */
    include?: ReadonlyArray<keyof S & string>;
    /** Keys never to persist. */
    exclude?: ReadonlyArray<keyof S & string>;
    /** Schema version written with the data. Defaults to 1. */
    version?: number;
    /**
     * Upgrades for data written by an older `version`, keyed by the version
     * each one produces. Data at version 1 loaded by a version 3 store runs
     * through `migrations[2]`, then `migrations[3]`.
     */
    migrations?: Record<number, (data: StoredState) => StoredState>;
    transform?: {
        /** Convert the slice before it is written, e.g. a `Date` to a string. */
        out?: (slice: Partial<S>) => StoredState;
        /** Convert loaded data back, after migrations. */
        in?: (data: StoredState) => StoredState;
    };
    /**
     * Check state-shaped data: the slice before `transform.out` on save, and
     * loaded data after `transform.in`. Returning false skips the save or
     * the load.
     */
    validator?: (data: StoredState) => boolean;
    /** Encode the envelope for the adapter. Defaults to `JSON.stringify`. */
    serialize?: (payload: PersistedData) => string;
    /**
     * Decode what the adapter returned. The result is untrusted: it is
     * sanitised and version-checked before use. Defaults to a JSON parse that
     * drops prototype-pollution keys.
     */
    deserialize?: (raw: string) => unknown;
    /** Delay before a change is written. Defaults to 300 ms. */
    debounceMs?: number;
    onError?: (error: Error, operation: PersistenceOperation) => void;
}

export interface PersistenceManager {
    /** Write now, without waiting for the debounce. */
    save(): Promise<void>;
    /** Read from the adapter and apply the result to the store. */
    load(): Promise<void>;
    /** Remove the stored data. The store keeps persisting later changes. */
    clear(): Promise<void>;
    getAdapter(): PersistenceAdapter;
    /** Whether the first load has finished. */
    isRehydrated(): boolean;
    /** Write any pending change, then stop persisting. */
    destroy(): void;
}
