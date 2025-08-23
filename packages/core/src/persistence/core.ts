import { debounce } from '../utils/debouce';
import type {
    PersistenceConfig,
    PersistedData,
    PersistenceManager,
} from '../type/persistence-types';

export function createPersistenceManager<T extends Record<string, any>>(
    getState: () => T,
    setState: (newState: Partial<T>) => void,
    notifySubscribers: () => void,
    config: PersistenceConfig<T>,
    storeName?: string,
): PersistenceManager {
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

    // Create debounced save function
    const debouncedSave = debounce(async () => {
        if (isHydrating) return;

        try {
            const state = getState();
            let dataToSave = { ...state };

            // Apply include/exclude filters
            if (include) {
                dataToSave = include.reduce((acc, key) => {
                    if (key in state) acc[key] = state[key];
                    return acc;
                }, {} as any);
            }

            if (exclude) {
                exclude.forEach((key) => delete dataToSave[key]);
            }

            // Apply output transform
            if (transform?.out) {
                dataToSave = transform.out(dataToSave);
            }

            // Validate data before saving
            if (validator && !validator(dataToSave)) {
                throw new Error('Data validation failed before saving');
            }

            // Create persisted data structure
            const persistedData: PersistedData<T> = {
                data: dataToSave,
                version,
                timestamp: Date.now(),
                storeName: storeName || 'anonymous',
            };

            // Use serialize function if provided
            const serializedData = serialize(persistedData);
            await adapter.write(serializedData);
        } catch (error) {
            const persistError =
                error instanceof Error ? error : new Error(String(error));
            onError?.(persistError, 'write');
            console.warn(`Failed to persist state: ${persistError.message}`);
        }
    }, debounceMs);

    // Load persisted state
    const load = async (): Promise<void> => {
        try {
            isHydrating = true;
            const rawData = await adapter.read();

            if (rawData) {
                // Use deserialize function if provided
                const persistedData = deserialize(rawData);
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
            const persistError =
                error instanceof Error ? error : new Error(String(error));
            onError?.(persistError, 'read');
            console.warn(
                `Failed to load persisted state: ${persistError.message}`,
            );
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
                        const newData = deserialize(rawData);
                        let data = newData.data || newData;

                        if (transform?.in) {
                            data = transform.in(data);
                        }

                        setState(data);
                        notifySubscribers();
                    } catch (error) {
                        console.warn('Cross-tab sync failed:', error);
                    } finally {
                        isHydrating = false;
                    }
                }
            });
        }
    };

    // Initialize
    load().then(() => {
        setupCrossTabSync();
    });

    return {
        async save() {
            await debouncedSave.flush();
        },

        load,

        async clear() {
            try {
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
    };
}
