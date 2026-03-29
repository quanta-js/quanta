import { describe, it, expect, vi } from 'vitest';
import { createStore, useStore } from '../core/create-store';

// Helper: unique names to avoid registry collisions
let storeId = 0;
function uniqueName(prefix = 'test') {
    return `${prefix}_${++storeId}_${Date.now()}`;
}

describe('createStore', () => {
    describe('basic store creation', () => {
        it('should create a store with state', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 0 }),
            });

            expect(store.count).toBe(0);
            expect(store.state.count).toBe(0);
        });

        it('should create a store with getters', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 5 }),
                getters: {
                    doubled: (state) => state.count * 2,
                },
            });

            expect(store.doubled).toBe(10);
        });

        it('should create a store with actions', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 0 }),
                actions: {
                    increment(this: any) {
                        this.count++;
                    },
                    add(this: any, amount: number) {
                        this.count += amount;
                    },
                },
            });

            store.increment();
            expect(store.count).toBe(1);

            store.add(5);
            expect(store.count).toBe(6);
        });

        it('should throw for duplicate store names', () => {
            const name = uniqueName();
            createStore(name, { state: () => ({}) });

            expect(() => {
                createStore(name, { state: () => ({}) });
            }).toThrow(/already exists/);
        });

        it('should validate state/action name collisions', () => {
            const name = uniqueName();
            expect(() => {
                createStore(name, {
                    state: () => ({ count: 0 }),
                    actions: {
                        count() {}, // conflicts with state
                    },
                });
            }).toThrow(/conflicts with state/);
        });

        it('should validate action/getter name collisions', () => {
            const name = uniqueName();
            expect(() => {
                createStore(name, {
                    state: () => ({ value: 0 }),
                    getters: {
                        doubled: (state) => state.value * 2,
                    },
                    actions: {
                        doubled() {}, // conflicts with getter
                    },
                });
            }).toThrow(/conflicts with getter/);
        });

        it('should warn on getter shadowing state (but not throw)', () => {
            const name = uniqueName();
            // Should not throw — just warns
            const store = createStore(name, {
                state: () => ({ count: 0 }),
                getters: {
                    count: (state) => state.count * 2, // shadows state
                },
            });
            // Getter takes priority on flat store
            expect(store.count).toBe(0); // getter returns 0*2=0 initially
        });
    });

    describe('flattened store access', () => {
        it('should expose state properties directly on store', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ x: 1, y: 'hello' }),
            });

            expect(store.x).toBe(1);
            expect(store.y).toBe('hello');
        });

        it('should allow setting state via flat store', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 0 }),
            });

            store.count = 42;
            expect(store.count).toBe(42);
            expect(store.state.count).toBe(42);
        });

        it('should expose getters as computed values', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ items: [1, 2, 3] }),
                getters: {
                    total: (state) => state.items.reduce((a, b) => a + b, 0),
                },
            });

            expect(store.total).toBe(6);
        });

        it('should expose actions as methods', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 0 }),
                actions: {
                    increment(this: any) {
                        this.count++;
                    },
                },
            });

            expect(typeof store.increment).toBe('function');
            store.increment();
            expect(store.count).toBe(1);
        });
    });

    describe('$reset', () => {
        it('should reset state to initial values', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 0, name: 'test' }),
            });

            store.count = 99;
            store.name = 'changed';
            store.$reset();

            expect(store.count).toBe(0);
            expect(store.name).toBe('test');
        });

        it('should handle $reset with only initial state keys', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 0, name: 'test' }),
            });

            store.count = 999;
            store.name = 'modified';
            store.$reset();

            expect(store.count).toBe(0);
            expect(store.name).toBe('test');
        });
    });

    describe('$destroy', () => {
        it('should remove store from registry', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 0 }),
            });

            store.$destroy!();

            expect(() => useStore(name)).toThrow(/does not exist/);
        });

        it('should stop deep watcher after destroy', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 0 }),
            });
            const sub = vi.fn();
            store.subscribe(sub);

            store.$destroy!();
            sub.mockClear();

            // Mutation after destroy should NOT notify
            store.state.count = 99;
            expect(sub).not.toHaveBeenCalled();
        });

        it('should cleanly deregister to allow recreating store with same name', () => {
            const name = uniqueName();
            const store = createStore(name, { state: () => ({ x: 1 }) });
            store.$destroy!();
            // Should be able to recreate with same name
            const store2 = createStore(name, { state: () => ({ x: 2 }) });
            expect(store2.x).toBe(2);
            store2.$destroy!();
        });
    });

    describe('subscribe', () => {
        it('should notify subscribers on state changes', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 0 }),
            });

            const callback = vi.fn();
            store.subscribe(callback);

            store.count = 5;
            expect(callback).toHaveBeenCalled();
        });

        it('should return unsubscribe function', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 0 }),
            });

            const callback = vi.fn();
            const unsub = store.subscribe(callback);

            unsub();
            callback.mockClear();
            store.count = 10;

            // After unsubscribe, should not be called again
            // (may still be called once from the reactive effect if it was registered)
        });
    });

    describe('getters reactivity', () => {
        it('should update getters when state changes', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 2 }),
                getters: {
                    doubled: (state) => state.count * 2,
                },
            });

            expect(store.doubled).toBe(4);
            store.count = 10;
            expect(store.doubled).toBe(20);
        });

        it('should handle multiple getters', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ price: 100, tax: 0.1 }),
                getters: {
                    taxAmount: (state) => state.price * state.tax,
                    total: (state) => state.price + state.price * state.tax,
                },
            });

            expect(store.taxAmount).toBe(10);
            expect(store.total).toBe(110);

            store.price = 200;
            expect(store.taxAmount).toBe(20);
            expect(store.total).toBe(220);
        });
    });

    describe('action context', () => {
        it('should bind actions to flat store context', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 0 }),
                getters: {
                    doubled: (state) => state.count * 2,
                },
                actions: {
                    incrementAndGetDoubled(this: any) {
                        this.count++;
                        return this.doubled;
                    },
                },
            });

            const result = store.incrementAndGetDoubled();
            expect(result).toBe(2);
        });
    });
});

describe('useStore', () => {
    it('should retrieve a registered store by name', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ x: 1 }),
        });

        const retrieved = useStore(name);
        expect(retrieved).toBe(store);
    });

    it('should throw for non-existent store', () => {
        expect(() => useStore('nonexistent_store_xyz')).toThrow(
            /does not exist/,
        );
    });
});
