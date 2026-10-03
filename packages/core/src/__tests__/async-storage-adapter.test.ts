import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../core/container';
import { defineStore } from '../core/define-store';
import {
    AsyncStorageAdapter,
    type AsyncStorageLike,
} from '../persistence/adapters/asyncStorage';
import { logger } from '../services/logger-service';

class MemoryStorage implements AsyncStorageLike {
    readonly data = new Map<string, string>();

    getItem = vi.fn(async (key: string): Promise<string | null> => {
        return this.data.get(key) ?? null;
    });

    setItem = vi.fn(async (key: string, value: string): Promise<void> => {
        this.data.set(key, value);
    });

    removeItem = vi.fn(async (key: string): Promise<void> => {
        this.data.delete(key);
    });
}

beforeEach(() => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('AsyncStorageAdapter', () => {
    it('round-trips strings and removes only its own key', async () => {
        const storage = new MemoryStorage();
        storage.data.set('other', 'keep');
        const adapter = new AsyncStorageAdapter('state', storage);

        await expect(adapter.read()).resolves.toBeNull();
        await adapter.write('{"count":1}');
        await expect(adapter.read()).resolves.toBe('{"count":1}');
        expect(storage.setItem).toHaveBeenCalledWith('state', '{"count":1}');

        await adapter.remove();
        await expect(adapter.read()).resolves.toBeNull();
        expect(storage.data.get('other')).toBe('keep');
    });

    it('returns null and warns when reading fails', async () => {
        const storage = new MemoryStorage();
        const error = new Error('blocked');
        storage.getItem.mockRejectedValueOnce(error);
        const adapter = new AsyncStorageAdapter('state', storage);

        await expect(adapter.read()).resolves.toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining(
                'AsyncStorageAdapter: read failed: blocked',
            ),
        );
    });

    it('rethrows write failures so persistence onError can handle them', async () => {
        const storage = new MemoryStorage();
        const error = new Error('full');
        storage.setItem.mockRejectedValueOnce(error);
        const adapter = new AsyncStorageAdapter('state', storage);

        await expect(adapter.write('value')).rejects.toBe(error);
    });

    it('rethrows remove failures', async () => {
        const storage = new MemoryStorage();
        const error = new Error('blocked');
        storage.removeItem.mockRejectedValueOnce(error);
        const adapter = new AsyncStorageAdapter('state', storage);

        await expect(adapter.remove()).rejects.toBe(error);
    });

    it('restores store state and reports store-level write failures', async () => {
        const storage = new MemoryStorage();
        const onError = vi.fn();
        const useStore = defineStore('async-storage-integration', {
            state: () => ({ count: 0 }),
            persist: {
                adapter: new AsyncStorageAdapter('state', storage),
                debounceMs: 0,
                onError,
            },
        });

        const first = useStore(createContainer('async-storage-first'));
        await first.$hydrated;
        first.count = 7;
        await first.$persist!.save();

        const restored = useStore(createContainer('async-storage-restored'));
        await restored.$hydrated;
        expect(restored.count).toBe(7);

        const error = new Error('full');
        storage.setItem.mockRejectedValueOnce(error);
        restored.count = 8;
        await restored.$persist!.save();

        expect(onError).toHaveBeenCalledWith(error, 'write');
    });
});
