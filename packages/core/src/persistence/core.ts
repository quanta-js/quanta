import { debounce } from '../utils/debounce';
import type {
    PersistenceConfig,
    PersistedData,
    PersistenceManager,
} from '../type/persistence-types';
import { logger } from '../services/logger-service';
import { __DEV__ } from '../utils/env';
import { watch } from '../state';
import { toRaw } from '../core/create-reactive';
import { sanitizePayload, safeJsonParse, isSafeKey } from '../utils/sanitize';

type PersistOperation = 'read' | 'write' | 'remove' | 'watch-setup';

/**
 * Wire a store's state to a storage adapter.
 *
 * Responsibilities: hydrate on start, auto-save on change (debounced), keep
 * other tabs in sync, and run schema migrations.
 *
 * ## Trust model
 *
 * Everything an adapter returns is **untrusted input**. Local storage is
 * writable by any script on the origin, and a `storage` event can be forged by
 * a compromised tab. Payloads are therefore sanitised for prototype-pollution
 * keys, version-checked, and passed through the caller's `validator` before
 * they are allowed anywhere near application state.
 */
export function createPersistenceManager<T extends Record<string, unknown>>(
    getState: () => T,
    setState: (newState: Partial<T>) => void,
    notifySubscribers: () => void,
    config: PersistenceConfig<T>,
    storeName = 'anonymous',
    onHydrated?: () => void,
): PersistenceManager {
    const {
        adapter,
        serialize = JSON.stringify,
        // Prototype-pollution-safe by default. A caller supplying their own
        // `deserialize` opts out, which is why the result is still sanitised
        // below rather than trusting this alone.
        deserialize = safeJsonParse as (raw: string) => unknown,
        debounceMs = 300,
        include,
        exclude,
        transform,
        version = 1,
        migrations = {},
        onError,
        validator,
    } = config;

    let isHydrating = false;
    let isRehydrated = false;
    let destroyed = false;
    let crossTabUnsubscribe: (() => void) | null = null;
    let autoSaveUnsub: (() => void) | null = null;

    /**
     * Monotonic counter bumped by the auto-save watcher.
     *
     * The previous implementation serialised the entire persisted slice inside
     * the watch *source* on every mutation, then serialised it again in the
     * debounced save — O(state size) work twice per keystroke, before
     * debouncing could help. Now the watcher only marks the slice dirty and
     * the single serialise happens once, after the debounce settles.
     */
    let pendingWrites = 0;
    let lastWritten: string | null = null;

    const fail = (error: unknown, phase: PersistOperation): void => {
        const err = error instanceof Error ? error : new Error(String(error));
        try {
            onError?.(err, phase);
        } catch {
            /* a failing error handler must not mask the original failure */
        }
        if (__DEV__) {
            logger.warn(
                `Persistence: ${phase} failed for "${storeName}": ${err.message}`,
            );
        }
    };

    /* -------------------------------------------------------------- *
     * Payload shaping
     * -------------------------------------------------------------- */

    /** Narrow raw adapter output to a payload we are willing to act on. */
    const normalize = (raw: unknown): PersistedData<T> | null => {
        if (!raw || typeof raw !== 'object') return null;
        const record = raw as Record<string, unknown>;
        const data = record.data;
        if (!data || typeof data !== 'object') return null;

        return {
            data: data as T,
            version:
                typeof record.version === 'number' ? record.version : version,
            timestamp:
                typeof record.timestamp === 'number'
                    ? record.timestamp
                    : Date.now(),
            storeName:
                typeof record.storeName === 'string'
                    ? record.storeName
                    : storeName,
        };
    };

    /** Build the subset of state that should be written. */
    const buildSlice = (state: T): Partial<T> => {
        // `toRaw` avoids walking the reactive proxy: we only need the values,
        // and going through traps here would register spurious dependencies
        // and pay proxy overhead on every key.
        const source = toRaw(state);
        let slice: Partial<T>;

        if (include && include.length > 0) {
            slice = {} as Partial<T>;
            for (const key of include) {
                if (key in source) slice[key] = source[key];
            }
        } else {
            slice = { ...source };
            if (__DEV__ && !exclude) {
                logger.warn(
                    `Persistence: store "${storeName}" persists its entire state. ` +
                        `Prefer persist.include to avoid writing secrets or transient data to storage.`,
                );
            }
        }

        if (exclude && exclude.length > 0) {
            for (const key of exclude) delete slice[key];
        }

        return transform?.out ? transform.out(slice) : slice;
    };

    /* -------------------------------------------------------------- *
     * Write
     * -------------------------------------------------------------- */

    /** Serialise and write the current slice. Shared by auto-save and save(). */
    const writeNow = async (): Promise<void> => {
        if (destroyed || isHydrating) return;

        try {
            const slice = buildSlice(getState());

            if (validator && !validator(slice)) {
                throw new Error('Validation failed before saving');
            }

            const payload: PersistedData<T> = {
                data: slice as T,
                version,
                timestamp: Date.now(),
                storeName,
            };

            const encoded = serialize(payload as unknown as T);

            // Skip the adapter round-trip when nothing actually changed —
            // cheap protection against a watcher that fires on an unrelated key.
            if (encoded === lastWritten) return;

            await adapter.write(encoded);
            lastWritten = encoded;
            pendingWrites = 0;
        } catch (error) {
            fail(error, 'write');
        }
    };

    const debouncedSave = debounce(writeNow, debounceMs);

    /* -------------------------------------------------------------- *
     * Read
     * -------------------------------------------------------------- */

    /**
     * Convert an adapter payload into state, applying migrations, transforms
     * and validation. Returns null when the payload must be ignored.
     */
    const decode = (raw: unknown, phase: PersistOperation): T | null => {
        // Storage content is untrusted and may not be valid JSON at all —
        // another script on the origin can write anything to the key. A parse
        // failure must surface through onError, not escape as a raw
        // SyntaxError from inside a storage event handler.
        let parsed: unknown;
        try {
            parsed = typeof raw === 'string' ? deserialize(raw) : raw;
        } catch (error) {
            fail(error, phase);
            return null;
        }

        const payload = normalize(parsed);
        if (!payload) {
            fail(new Error('Persisted payload is malformed'), phase);
            return null;
        }

        // Never trust the writer, even if it was us: a rolled-back deployment
        // or a crafted payload can claim a version we have no migration path
        // from. Applying it unmigrated would silently corrupt state.
        if (payload.version > version) {
            fail(
                new Error(
                    `Persisted data is version ${payload.version} but this store is version ${version}; refusing to load. Bump the store version or clear the stored data.`,
                ),
                phase,
            );
            return null;
        }

        // Strip __proto__ / constructor / prototype at every depth before the
        // data can reach an assignment.
        let data = sanitizePayload(payload.data);

        if (payload.version < version) {
            for (let v = payload.version + 1; v <= version; v++) {
                const migrate = Object.prototype.hasOwnProperty.call(
                    migrations,
                    v,
                )
                    ? migrations[v]
                    : undefined;
                if (migrate) data = sanitizePayload(migrate(data)) as T;
            }
        }

        if (transform?.in) data = sanitizePayload(transform.in(data)) as T;

        if (validator && !validator(data)) {
            fail(new Error('Loaded data failed validation'), phase);
            return null;
        }

        // Final guard in case a custom transform reintroduced a bad key.
        for (const key of Object.keys(data as Record<string, unknown>)) {
            if (!isSafeKey(key)) {
                fail(new Error(`Refusing to load unsafe key "${key}"`), phase);
                return null;
            }
        }

        return data as T;
    };

    const load = async (): Promise<void> => {
        if (destroyed) return;
        isHydrating = true;
        try {
            const raw = await adapter.read();
            if (raw) {
                const data = decode(raw, 'read');
                if (data) {
                    setState(data);
                    notifySubscribers();
                }
            }
        } catch (error) {
            fail(error, 'read');
        } finally {
            isHydrating = false;
            isRehydrated = true;
            onHydrated?.();
        }
    };

    /* -------------------------------------------------------------- *
     * Cross-tab
     * -------------------------------------------------------------- */

    const setupCrossTabSync = (): void => {
        if (!adapter.subscribe || crossTabUnsubscribe || destroyed) return;

        crossTabUnsubscribe = adapter.subscribe((raw) => {
            if (isHydrating || !isRehydrated || destroyed) return;

            isHydrating = true;
            try {
                // A null/empty payload means the key was removed in another
                // tab. We do not reset local state on that signal: a remote
                // clear should not silently wipe the user's current session.
                if (raw === null || raw === undefined || raw === '') return;

                const data = decode(raw, 'read');
                if (data) {
                    setState(data);
                    notifySubscribers();
                }
            } finally {
                isHydrating = false;
            }
        });
    };

    /* -------------------------------------------------------------- *
     * Auto-save
     * -------------------------------------------------------------- */

    const setupAutoSave = (): void => {
        if (autoSaveUnsub || destroyed) return;
        try {
            autoSaveUnsub = watch(
                () => {
                    // Touch exactly the keys that are persisted so unrelated
                    // state does not schedule writes. Reading through the
                    // reactive proxy is what registers the dependency, so this
                    // deliberately does *not* use toRaw.
                    const state = getState() as Record<string, unknown>;
                    const keys =
                        include && include.length > 0
                            ? (include as string[])
                            : Object.keys(state);
                    const excluded = new Set((exclude ?? []) as string[]);

                    for (const key of keys) {
                        if (excluded.has(key)) continue;
                        void state[key];
                    }
                    return ++pendingWrites;
                },
                () => {
                    if (!isRehydrated || isHydrating) return;
                    debouncedSave();
                },
                // Deep so nested mutations inside a persisted key are caught.
                { deep: true },
            );
        } catch (error) {
            fail(error, 'watch-setup');
        }
    };

    // Hydrate, then start watching. Auto-save is only armed afterwards so the
    // act of hydrating cannot trigger a write-back of what we just read.
    void load().then(() => {
        setupAutoSave();
        setupCrossTabSync();
    });

    return {
        /**
         * Write immediately, bypassing the debounce.
         *
         * Always writes, even with nothing queued — an explicit `save()` that
         * silently did nothing (the previous behaviour, because `flush()`
         * no-ops on an empty queue) is a trap when called from a
         * `beforeunload` handler.
         */
        async save() {
            debouncedSave.cancel();
            await writeNow();
        },

        load,

        /**
         * Remove the persisted data.
         *
         * Auto-save is paused across the removal and re-armed afterwards, so
         * the store keeps persisting future changes. Previously `clear()`
         * disposed the watcher permanently and persistence silently stopped
         * for the rest of the session.
         */
        async clear() {
            debouncedSave.cancel();
            if (autoSaveUnsub) {
                autoSaveUnsub();
                autoSaveUnsub = null;
            }
            try {
                await adapter.remove();
                lastWritten = null;
            } catch (error) {
                const err =
                    error instanceof Error ? error : new Error(String(error));
                onError?.(err, 'remove');
                throw err;
            } finally {
                if (!destroyed) setupAutoSave();
            }
        },

        getAdapter: () => adapter,

        isRehydrated: () => isRehydrated,

        destroy() {
            destroyed = true;
            if (autoSaveUnsub) {
                autoSaveUnsub();
                autoSaveUnsub = null;
            }
            if (crossTabUnsubscribe) {
                crossTabUnsubscribe();
                crossTabUnsubscribe = null;
            }
            debouncedSave.cancel();
        },
    };
}
