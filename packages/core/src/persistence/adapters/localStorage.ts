import { logger } from '../../services/logger-service';
import { __DEV__ } from '../../utils/env';
import type { PersistenceAdapter } from '../../type/persistence-types';

import { storageAvailable } from './storage-available';

/**
 * Persist a store to `localStorage`.
 *
 * **SSR-safe.** On the server there is no storage, so the adapter degrades to
 * a no-op that reads `null` instead of throwing from its constructor. That is
 * what lets a store be declared at module scope in a Next.js / Remix / Nuxt
 * app: the server renders the state factory's defaults, and the real values
 * are applied after hydration.
 */
export class LocalStorageAdapter implements PersistenceAdapter {
    private readonly available: boolean;

    constructor(public key: string) {
        this.available = storageAvailable('localStorage');
        if (__DEV__ && !this.available && typeof window !== 'undefined') {
            logger.warn(
                `LocalStorageAdapter("${key}"): localStorage is unavailable (private mode or blocked); persistence is disabled.`,
            );
        }
    }

    read(): string | null {
        if (!this.available) return null;
        try {
            return localStorage.getItem(this.key);
        } catch (error) {
            if (__DEV__) {
                logger.warn(
                    `LocalStorageAdapter: read failed: ${
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
            localStorage.setItem(this.key, raw);
        } catch (error) {
            // Quota exhaustion is reported under several names across engines
            // (and as code 22 / 1014 in older ones), so match broadly.
            const name = error instanceof Error ? error.name : '';
            if (/quota|QUOTA_EXCEEDED|NS_ERROR_DOM_QUOTA/i.test(name)) {
                if (__DEV__) {
                    logger.warn(
                        `LocalStorageAdapter: quota exceeded writing "${this.key}" (${raw.length} chars). Reduce the persisted slice with persist.include.`,
                    );
                }
            }
            throw error;
        }
    }

    remove(): void {
        if (!this.available) return;
        try {
            localStorage.removeItem(this.key);
        } catch {
            /* nothing useful to do if removal fails */
        }
    }

    /**
     * Receive updates written by other tabs on the same origin.
     *
     * `storage` fires only in *other* documents, so this never echoes our own
     * writes back to us.
     */
    subscribe(callback: (data: string | null) => void): () => void {
        if (!this.available || typeof window === 'undefined') {
            return () => {};
        }

        const handler = (event: StorageEvent) => {
            // Confirm the event describes *our* key in *localStorage* —
            // sessionStorage events share this listener on some engines.
            if (event.key !== this.key) return;
            if (event.storageArea && event.storageArea !== localStorage) return;
            // newValue is null when the key was removed; forward it so the
            // manager can decide, rather than swallowing the signal here.
            callback(event.newValue);
        };

        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }
}
