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

        it('should call onError when persisted payload is malformed', async () => {
            const adapter = createMockAdapter();
            const onError = vi.fn();

            adapter.storage.set('test-key', JSON.stringify({ nope: true }));

            createPersistenceManager(() => ({ count: 0 }), vi.fn(), vi.fn(), {
                adapter,
                onError,
            });

            await vi.runAllTimersAsync();
            expect(onError).toHaveBeenCalledWith(expect.any(Error), 'read');
        });

        it('should call onError when cross-tab payload is malformed', async () => {
            const adapter = createMockAdapter();
            const onError = vi.fn();
            // Asserted rather than annotated, so the callback assigned inside
            // the mock is not narrowed away to null.
            let subscriptionCallback = null as ((data: any) => void) | null;

            adapter.subscribe = vi.fn((cb: (data: any) => void) => {
                subscriptionCallback = cb;
                return vi.fn();
            });

            createPersistenceManager(
                () => ({ count: 0 }),
                vi.fn(),
                vi.fn(),
                { adapter, onError },
                'cross-tab-store',
            );

            await vi.runAllTimersAsync();
            subscriptionCallback?.('bad-data');

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

        it('validates the slice before transform.out on save', async () => {
            const adapter = createMockAdapter();
            const validator = vi.fn(
                (data: Record<string, unknown>) =>
                    typeof data.count === 'number',
            );
            const manager = createPersistenceManager(
                () => ({ count: 2 }),
                vi.fn(),
                vi.fn(),
                {
                    adapter,
                    validator,
                    transform: { out: (s) => ({ count: String(s.count) }) },
                },
            );

            await vi.runAllTimersAsync();
            await manager.save();

            expect(validator).toHaveBeenCalledWith({ count: 2 });
            expect(JSON.parse(adapter.storage.get('test-key')).data).toEqual({
                count: '2',
            });
        });

        it('passes the envelope to serialize', async () => {
            const adapter = createMockAdapter();
            const serialize = vi.fn(JSON.stringify);
            const manager = createPersistenceManager(
                () => ({ count: 3 }),
                vi.fn(),
                vi.fn(),
                { adapter, serialize, version: 4 },
                'envelope-store',
            );

            await vi.runAllTimersAsync();
            await manager.save();

            expect(serialize).toHaveBeenCalledWith({
                data: { count: 3 },
                version: 4,
                timestamp: expect.any(Number),
                storeName: 'envelope-store',
            });
        });

        it('loads only keys in include', async () => {
            const adapter = createMockAdapter();
            const setState = vi.fn();
            // Written back when `token` was still persisted.
            adapter.storage.set(
                'test-key',
                JSON.stringify({
                    data: { theme: 'dark', token: 'old-token' },
                    version: 1,
                    timestamp: Date.now(),
                }),
            );

            createPersistenceManager(
                () => ({ theme: 'light', token: '' }),
                setState,
                vi.fn(),
                { adapter, include: ['theme'] },
            );
            await vi.runAllTimersAsync();

            expect(setState).toHaveBeenCalledWith({ theme: 'dark' });
        });

        it('does not load keys in exclude', async () => {
            const adapter = createMockAdapter();
            const setState = vi.fn();
            adapter.storage.set(
                'test-key',
                JSON.stringify({
                    data: { count: 1, secret: 'x' },
                    version: 1,
                    timestamp: Date.now(),
                }),
            );

            createPersistenceManager(
                () => ({ count: 0, secret: '' }),
                setState,
                vi.fn(),
                { adapter, exclude: ['secret'] },
            );
            await vi.runAllTimersAsync();

            expect(setState).toHaveBeenCalledWith({ count: 1 });
        });
    });
});
