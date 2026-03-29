import { debounce } from '../utils/debounce';
import type {
    PersistenceConfig,
    PersistedData,
    PersistenceManager,
} from '../type/persistence-types';
import { logger } from '../services/logger-service';
import { watch } from '../state';

export function createPersistenceManager<T extends Record<string, any>>(
    getState: () => T,
    setState: (newState: Partial<T>) => void,
    notifySubscribers: () => void,
    config: PersistenceConfig<T>,
    storeName?: string,
): PersistenceManager {
    type PersistOperation = 'read' | 'write' | 'remove' | 'watch-setup';
    const {
        adapter,
        serialize = JSON.stringify,
        deserialize = JSON.parse,
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
    let crossTabUnsubscribe: (() => void) | null = null;
    let autoSaveUnsub: (() => void) | null = null;
    let lastSerializedSlice: string | null = null;

    const notifyPersistError = (error: unknown, phase: PersistOperation) => {
        const persistError =
            error instanceof Error ? error : new Error(String(error));
        onError?.(persistError, phase);
        logger.warn(
            `Persistence: ${phase} failed for ${storeName || 'store'}: ${persistError.message}`,
        );
    };

    const normalizePersistedPayload = (
        rawPayload: unknown,
    ): PersistedData<T> | null => {
        if (!rawPayload || typeof rawPayload !== 'object') {
            return null;
        }

        const record = rawPayload as Record<string, unknown>;
        const data = record.data as T | undefined;
        if (!data || typeof data !== 'object') {
            return null;
        }

        return {
            data,
            version:
                typeof record.version === 'number' ? record.version : version,
            timestamp:
                typeof record.timestamp === 'number'
                    ? record.timestamp
                    : Date.now(),
            storeName:
                typeof record.storeName === 'string'
                    ? record.storeName
                    : storeName || 'anonymous',
        };
    };

    const buildPersistedSlice = (state: T): Partial<T> => {
        let dataToSave: Partial<T>;
        if (include && include.length > 0) {
            dataToSave = include.reduce((acc, key) => {
                if (key in state) {
                    acc[key] = state[key];
                }
                return acc;
            }, {} as Partial<T>);
        } else {
            dataToSave = { ...state };
        }

        if (exclude && exclude.length > 0) {
            for (const key of exclude) {
                delete dataToSave[key];
            }
        }

        if (transform?.out) {
            dataToSave = transform.out(dataToSave);
        }

        return dataToSave;
    };

    // Compute persisted slice (mirrors save logic, for watch source)
    const computePersistedSlice = (): Partial<T> | null => {
        const dataToSave = buildPersistedSlice(getState());
        // Validate
        if (validator && !validator(dataToSave)) {
            logger.warn(
                `Persistence: Slice validation failed for ${storeName || 'store'}—skipping watch trigger`,
            );
            return null; // "no-change" sentinel
        }
        return dataToSave;
    };

    // Create debounced save function
    const debouncedSave = debounce(async () => {
        if (isHydrating) return;

        try {
            const dataToSave = buildPersistedSlice(getState());

            // Validate data before saving
            if (validator && !validator(dataToSave)) {
                throw new Error('Data validation failed before saving');
            }

            // Create persisted data structure
            const persistedData: PersistedData<T> = {
                data: dataToSave as T,
                version,
                timestamp: Date.now(),
                storeName: storeName || 'anonymous',
            };

            // Use serialize function if provided
            const serializedData = serialize(persistedData);
            await adapter.write(serializedData);
            logger.debug(
                `Persistence: Saved slice for ${storeName || 'store'}`,
            );
        } catch (error) {
            notifyPersistError(error, 'write');
        }
    }, debounceMs);

    // Load persisted state
    const load = async (): Promise<void> => {
        try {
            isHydrating = true;
            const rawData = await adapter.read();

            if (rawData) {
                // Use deserialize function if provided
                const parsedPayload = deserialize(rawData);
                const persistedData = normalizePersistedPayload(parsedPayload);
                if (!persistedData) {
                    throw new Error('Persisted payload is malformed');
                }
                let { data, version: persistedVersion } = persistedData;

                // Run migrations if needed
                if (persistedVersion < version) {
                    for (let v = persistedVersion + 1; v <= version; v++) {
                        if (migrations[v]) {
                            data = migrations[v](data);
                        }
                    }
                }

                // Apply input transform
                if (transform?.in) {
                    data = transform.in(data);
                }

                // Validate loaded data
                if (validator && !validator(data)) {
                    throw new Error('Loaded data failed validation');
                }

                // Update state
                setState(data);
                notifySubscribers();
            }

            isRehydrated = true;
        } catch (error) {
            notifyPersistError(error, 'read');
            isRehydrated = true; // Mark as rehydrated even on error
        } finally {
            isHydrating = false;
        }
    };

    // Set up cross-tab synchronization
    const setupCrossTabSync = () => {
        if (adapter.subscribe && !crossTabUnsubscribe) {
            crossTabUnsubscribe = adapter.subscribe((rawData) => {
                if (!isHydrating && isRehydrated) {
                    isHydrating = true;
                    try {
                        // Use deserialize function if provided
                        const parsedPayload = deserialize(rawData);
                        const normalizedPayload =
                            normalizePersistedPayload(parsedPayload);
                        if (!normalizedPayload) {
                            throw new Error('Cross-tab payload is malformed');
                        }
                        let data = normalizedPayload.data;

                        if (transform?.in) {
                            data = transform.in(data);
                        }

                        if (validator && !validator(data)) {
                            throw new Error(
                                'Cross-tab payload failed validation',
                            );
                        }

                        setState(data);
                        notifySubscribers();
                    } catch (error) {
                        notifyPersistError(error, 'read');
                    } finally {
                        isHydrating = false;
                    }
                }
            });
        }
    };

    // Auto-save watcher—triggers on persisted slice changes (deep via JSON)
    const setupAutoSave = () => {
        if (autoSaveUnsub) return; // Idempotent
        try {
            // Watch serialized slice: Re-runs effect only on relevant changes
            autoSaveUnsub = watch(
                () => {
                    if (isHydrating) return null;
                    const slice = computePersistedSlice();
                    if (!slice) return null;
                    const serializedSlice = serialize({ data: slice });
                    if (serializedSlice === lastSerializedSlice) {
                        return lastSerializedSlice;
                    }
                    lastSerializedSlice = serializedSlice;
                    return serializedSlice;
                },
                () => {
                    if (!isRehydrated) return;
                    debouncedSave();
                },
                { deep: true },
            );
            logger.debug(
                `Persistence: Auto-save watcher active for ${storeName || 'store'}`,
            );
        } catch (error) {
            const err =
                error instanceof Error ? error : new Error(String(error));
            onError?.(err, 'watch-setup');
            logger.warn(
                `Persistence: Auto-save setup failed for ${storeName || 'store'}: ${err.message}`,
            );
        }
    };

    // Initialize
    load().then(() => {
        setupAutoSave();
        setupCrossTabSync();
    });

    return {
        async save() {
            await debouncedSave.flush();
        },

        load,

        async clear() {
            try {
                if (autoSaveUnsub) {
                    autoSaveUnsub();
                    autoSaveUnsub = null;
                }
                await adapter.remove();
                if (crossTabUnsubscribe) {
                    crossTabUnsubscribe();
                    crossTabUnsubscribe = null;
                }
            } catch (error) {
                const persistError =
                    error instanceof Error ? error : new Error(String(error));
                onError?.(persistError, 'remove');
                throw persistError;
            }
        },

        getAdapter() {
            return adapter;
        },

        isRehydrated() {
            return isRehydrated;
        },

        destroy() {
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
