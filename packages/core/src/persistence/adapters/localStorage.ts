import { logger } from '../../services/logger-service';
import type { PersistenceAdapter } from '../../type/persistence-types';

export class LocalStorageAdapter implements PersistenceAdapter {
    constructor(public key: string) {
        if (typeof window === 'undefined' || !window.localStorage) {
            throw new Error(
                'LocalStorage is not available in this environment',
            );
        }
    }

    read() {
        try {
            const data = localStorage.getItem(this.key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.warn(
                `Failed to read from localStorage: ${error instanceof Error ? error.message : String(error)}`,
            );
            return null;
        }
    }

    write(data: any) {
        try {
            localStorage.setItem(this.key, JSON.stringify(data));
        } catch (error) {
            if (error instanceof Error && error.name === 'QuotaExceededError') {
                logger.warn('LocalStorage quota exceeded');
            }
            throw error;
        }
    }

    remove() {
        localStorage.removeItem(this.key);
    }

    subscribe(callback: (data: any) => void) {
        const handler = (e: StorageEvent) => {
            if (e.key === this.key && e.newValue) {
                try {
                    callback(JSON.parse(e.newValue));
                } catch (error) {
                    logger.warn('Failed to parse storage event data:', error);
                }
            }
        };

        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }
}
