import { logger } from '../../services/logger-service';
import { __DEV__ } from '../../utils/env';
import type { PersistenceAdapter } from '../../type/persistence-types';

export interface AsyncStorageLike {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}

/**
 * Persist a store through an AsyncStorage-compatible backend.
 *
 * The storage implementation is injected so `@quantajs/core` does not depend
 * on React Native or a specific AsyncStorage package.
 */
export class AsyncStorageAdapter implements PersistenceAdapter {
    constructor(
        public key: string,
        private readonly storage: AsyncStorageLike,
    ) {}

    async read(): Promise<string | null> {
        try {
            return await this.storage.getItem(this.key);
        } catch (error) {
            if (__DEV__) {
                logger.warn(
                    `AsyncStorageAdapter: read failed: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }
            return null;
        }
    }

    async write(data: string): Promise<void> {
        await this.storage.setItem(this.key, data);
    }

    async remove(): Promise<void> {
        await this.storage.removeItem(this.key);
    }
}
