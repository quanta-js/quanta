import { logger } from '../../services/logger-service';
import { __DEV__ } from '../../utils/env';
import type { PersistenceAdapter } from '../../type/persistence-types';

import { storageAvailable } from './storage-available';

/**
 * Persist a store to `sessionStorage` — per-tab state that survives reload but
 * not a new tab.
 *
 * **SSR-safe.** On the server there is no storage, so the adapter degrades to
 * a no-op that reads `null` instead of throwing from its constructor.
 */
export class SessionStorageAdapter implements PersistenceAdapter {
    private readonly available: boolean;

    constructor(public key: string) {
        this.available = storageAvailable('sessionStorage');
        if (__DEV__ && !this.available && typeof window !== 'undefined') {
            logger.warn(
                `SessionStorageAdapter("${key}"): sessionStorage is unavailable (private mode or blocked); persistence is disabled.`,
            );
        }
    }

    read(): string | null {
        if (!this.available) return null;
        try {
            return sessionStorage.getItem(this.key);
        } catch (error) {
            if (__DEV__) {
                logger.warn(
                    `SessionStorageAdapter: read failed: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }
            return null;
        }
    }

    write(data: string): void {
        if (!this.available) return;
        const raw = typeof data === 'string' ? data : JSON.stringify(data);
        try {
            sessionStorage.setItem(this.key, raw);
        } catch (error) {
            // Quota exhaustion is reported under several names across engines
            // (and as code 22 / 1014 in older ones), so match broadly.
            const name = error instanceof Error ? error.name : '';
            if (/quota|QUOTA_EXCEEDED|NS_ERROR_DOM_QUOTA/i.test(name)) {
                if (__DEV__) {
                    logger.warn(
                        `SessionStorageAdapter: quota exceeded writing "${this.key}" (${raw.length} chars). Reduce the persisted slice with persist.include.`,
                    );
                }
            }
            throw error;
        }
    }

    remove(): void {
        if (!this.available) return;
        try {
            sessionStorage.removeItem(this.key);
        } catch {
            /* nothing useful to do if removal fails */
        }
    }

    // No `subscribe`: sessionStorage is scoped to a single tab, so cross-tab
    // synchronisation is meaningless for it. Omitting the method (rather than
    // providing an empty one) lets the persistence manager skip its cross-tab
    // wiring entirely.
}
