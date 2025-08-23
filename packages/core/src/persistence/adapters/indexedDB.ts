import { logger } from '../../services/logger-service';
import type { PersistenceAdapter } from '../../type/persistence-types';

export class IndexedDBAdapter implements PersistenceAdapter {
    constructor(
        public key: string,
        private dbName = 'quantajs',
        private storeName = 'stores',
        private version = 1,
    ) {}

    async read() {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            return new Promise<any>((resolve, reject) => {
                const request = store.get(this.key);
                request.onsuccess = () => resolve(request.result?.data || null);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            logger.warn(
                `IndexedDB read failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            return null;
        }
    }

    async write(data: any) {
        const db = await this.openDB();
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        return new Promise<void>((resolve, reject) => {
            const record = {
                key: this.key,
                data,
                timestamp: Date.now(),
            };

            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async remove() {
        const db = await this.openDB();
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        return new Promise<void>((resolve, reject) => {
            const request = store.delete(this.key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    private async openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}
