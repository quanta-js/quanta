import { logger } from '../../services/logger-service';
import type { PersistenceAdapter } from '../../type/persistence-types';

export class SessionStorageAdapter implements PersistenceAdapter {
    constructor(public key: string) {
        if (typeof window === 'undefined' || !window.sessionStorage) {
            throw new Error(
                'SessionStorage is not available in this environment',
            );
        }
    }

    read() {
        try {
            const data = sessionStorage.getItem(this.key);
            // Return raw string — persistence manager handles deserialization
            return data ?? null;
        } catch (error) {
            logger.warn(
                `Failed to read from sessionStorage: ${error instanceof Error ? error.message : String(error)}`,
            );
            return null;
        }
    }

    write(data: any) {
        try {
            // Data is already serialized by the persistence manager — write directly
            const raw = typeof data === 'string' ? data : JSON.stringify(data);
            sessionStorage.setItem(this.key, raw);
        } catch (error) {
            if (error instanceof Error && error.name === 'QuotaExceededError') {
                logger.warn('SessionStorage quota exceeded');
            }
            throw error;
        }
    }

    remove() {
        sessionStorage.removeItem(this.key);
    }

    // Note: SessionStorage's 'storage' event only fires in OTHER tabs/windows,
    // and sessionStorage is scoped to a single tab. Cross-tab sync is not
    // meaningful for sessionStorage, so subscribe is intentionally omitted.
}
