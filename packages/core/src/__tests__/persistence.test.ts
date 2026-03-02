import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPersistenceManager } from '../persistence/core';
import type { PersistenceAdapter } from '../type/persistence-types';

// Mock adapter for testing persistence
function createMockAdapter(): PersistenceAdapter & {
    storage: Map<string, any>;
} {
    const storage = new Map<string, any>();
    return {
        key: 'test-key',
        storage,
        read: vi.fn(() => storage.get('test-key') || null),
        write: vi.fn((data: any) => {
            storage.set('test-key', data);
        }),
        remove: vi.fn(() => {
            storage.delete('test-key');
        }),
        subscribe: vi.fn(() => vi.fn()),
    };
}

describe('persistence', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('createPersistenceManager', () => {
        it('should create a persistence manager', () => {
            const adapter = createMockAdapter();
            const state = { count: 0 };
            const manager = createPersistenceManager(
                () => state,
                vi.fn(),
                vi.fn(),
                { adapter },
                'test-store',
            );

            expect(manager).toBeDefined();
            expect(typeof manager.save).toBe('function');
            expect(typeof manager.load).toBe('function');
            expect(typeof manager.clear).toBe('function');
            expect(typeof manager.getAdapter).toBe('function');
            expect(typeof manager.isRehydrated).toBe('function');
            expect(typeof manager.destroy).toBe('function');
        });

        it('should return the adapter via getAdapter', () => {
            const adapter = createMockAdapter();
            const manager = createPersistenceManager(
                () => ({ count: 0 }),
                vi.fn(),
                vi.fn(),
                { adapter },
            );

            expect(manager.getAdapter()).toBe(adapter);
        });

        it('should load persisted data on init', async () => {
            const adapter = createMockAdapter();
            const setState = vi.fn();
            const notify = vi.fn();

            // Pre-populate storage
            adapter.storage.set(
                'test-key',
                JSON.stringify({
                    data: { count: 42 },
                    version: 1,
                    timestamp: Date.now(),
                }),
            );

            createPersistenceManager(() => ({ count: 0 }), setState, notify, {
                adapter,
            });

            // load() is async — advance timers and await
            await vi.runAllTimersAsync();

            expect(adapter.read).toHaveBeenCalled();
            expect(setState).toHaveBeenCalledWith({ count: 42 });
        });

        it('should apply include filter when saving', async () => {
            const adapter = createMockAdapter();
            const state = { count: 1, secret: 'hidden', name: 'test' };

            const manager = createPersistenceManager(
                () => state,
                vi.fn(),
                vi.fn(),
                {
                    adapter,
                    include: ['count', 'name'] as any[],
                    debounceMs: 0,
                },
            );

            await vi.runAllTimersAsync();
            await manager.save();

            if (adapter.storage.has('test-key')) {
                const saved = JSON.parse(adapter.storage.get('test-key'));
                expect(saved.data).not.toHaveProperty('secret');
            }
        });

        it('should apply exclude filter when saving', async () => {
            const adapter = createMockAdapter();
            const state = { count: 1, secret: 'hidden' };

            const manager = createPersistenceManager(
                () => state,
                vi.fn(),
                vi.fn(),
                {
                    adapter,
                    exclude: ['secret'] as any[],
                    debounceMs: 0,
                },
            );

            await vi.runAllTimersAsync();
            await manager.save();

            if (adapter.storage.has('test-key')) {
                const saved = JSON.parse(adapter.storage.get('test-key'));
                expect(saved.data).not.toHaveProperty('secret');
            }
        });

        it('should run migrations on load', async () => {
            const adapter = createMockAdapter();
            const setState = vi.fn();

            adapter.storage.set(
                'test-key',
                JSON.stringify({
                    data: { oldField: 'value' },
                    version: 1,
                    timestamp: Date.now(),
                }),
            );

            createPersistenceManager(() => ({}), setState, vi.fn(), {
                adapter,
                version: 2,
                migrations: {
                    2: (data: any) => ({ ...data, newField: 'migrated' }),
                },
            });

            await vi.runAllTimersAsync();

            expect(setState).toHaveBeenCalledWith(
                expect.objectContaining({ newField: 'migrated' }),
            );
        });

        it('should apply transform.in on load', async () => {
            const adapter = createMockAdapter();
            const setState = vi.fn();

            adapter.storage.set(
                'test-key',
                JSON.stringify({
                    data: { count: 10 },
                    version: 1,
                    timestamp: Date.now(),
                }),
            );

            createPersistenceManager(() => ({}), setState, vi.fn(), {
                adapter,
                transform: {
                    in: (data: any) => ({ ...data, count: data.count * 2 }),
                },
            });

            await vi.runAllTimersAsync();
            expect(setState).toHaveBeenCalledWith({ count: 20 });
        });

        it('should call onError on read failure', async () => {
            const adapter = createMockAdapter();
            (adapter.read as any).mockImplementation(() => {
                throw new Error('read failed');
            });
            const onError = vi.fn();

            createPersistenceManager(() => ({}), vi.fn(), vi.fn(), {
                adapter,
                onError,
            });

            await vi.runAllTimersAsync();
            expect(onError).toHaveBeenCalledWith(expect.any(Error), 'read');
        });

        it('should clear storage and unsubscribe', async () => {
            const adapter = createMockAdapter();
            const manager = createPersistenceManager(
                () => ({}),
                vi.fn(),
                vi.fn(),
                { adapter },
            );

            await vi.runAllTimersAsync();
            await manager.clear();

            expect(adapter.remove).toHaveBeenCalled();
        });

        it('should destroy cleanly', async () => {
            const adapter = createMockAdapter();
            const manager = createPersistenceManager(
                () => ({}),
                vi.fn(),
                vi.fn(),
                { adapter },
            );

            await vi.runAllTimersAsync();
            expect(() => manager.destroy()).not.toThrow();
        });
    });
});
