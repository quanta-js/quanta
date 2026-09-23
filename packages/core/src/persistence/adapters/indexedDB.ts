import { logger } from '../../services/logger-service';
import { __DEV__ } from '../../utils/env';
import type { PersistenceAdapter } from '../../type/persistence-types';

/**
 * Persist a store to IndexedDB.
 *
 * One connection is opened lazily and reused. Opening a new one per
 * operation, as before, left an unclosed connection behind on every
 * debounced save, and open connections block a later version upgrade.
 *
 * **SSR-safe.** Where `indexedDB` does not exist, reads return `null` and
 * writes do nothing.
 */
export class IndexedDBAdapter implements PersistenceAdapter {
    private connection: Promise<IDBDatabase> | null = null;

    constructor(
        public key: string,
        private dbName = 'quantajs',
        private storeName = 'stores',
        private version = 1,
    ) {}

    private get available(): boolean {
        return typeof indexedDB !== 'undefined';
    }

    async read() {
        if (!this.available) return null;
        try {
            const db = await this.openDB();
            const store = db
                .transaction([this.storeName], 'readonly')
                .objectStore(this.storeName);

            return await new Promise<unknown>((resolve, reject) => {
                const request = store.get(this.key);
                request.onsuccess = () => resolve(request.result?.data ?? null);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            if (__DEV__) {
                logger.warn(
                    `IndexedDB read failed: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
            return null;
        }
    }

    async write(data: unknown) {
        if (!this.available) return;
        const db = await this.openDB();
        const store = db
            .transaction([this.storeName], 'readwrite')
            .objectStore(this.storeName);

        return new Promise<void>((resolve, reject) => {
            const request = store.put({
                key: this.key,
                data,
                timestamp: Date.now(),
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async remove() {
        if (!this.available) return;
        const db = await this.openDB();
        const store = db
            .transaction([this.storeName], 'readwrite')
            .objectStore(this.storeName);

        return new Promise<void>((resolve, reject) => {
            const request = store.delete(this.key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /** Open the database once and reuse the connection. */
    private openDB(): Promise<IDBDatabase> {
        if (this.connection) return this.connection;

        this.connection = new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };

            request.onsuccess = () => {
                const db = request.result;
                // Step aside for another tab upgrading the schema, and
                // reconnect on the next operation.
                db.onversionchange = () => {
                    db.close();
                    this.connection = null;
                };
                db.onclose = () => {
                    this.connection = null;
                };
                resolve(db);
            };
            request.onerror = () => {
                this.connection = null;
                reject(request.error);
            };
        });

        return this.connection;
    }
}
