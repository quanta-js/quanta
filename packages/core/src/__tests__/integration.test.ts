import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../core/create-store';
import { createReactive } from '../core/create-reactive';
import { reactiveEffect } from '../core/effect';
import computed from '../state/computed';
import watch from '../state/watch';
import reactive from '../state/reactive';

// Unique store names to avoid registry collisions
let storeId = 0;
function uniqueName(prefix = 'integ') {
    return `${prefix}_${++storeId}_${Date.now()}`;
}

describe('integration tests', () => {
    describe('reactive + computed + watch', () => {
        it('should wire reactive state → computed → watch', () => {
            const state = reactive({ price: 100, quantity: 2 });
            const total = computed(() => state.price * state.quantity);
            const history: number[] = [];

            watch(
                () => total.value,
                (val) => history.push(val),
            );

            expect(history).toContain(200);

            state.quantity = 5;
            expect(total.value).toBe(500);
            expect(history).toContain(500);
        });
    });

    describe('store end-to-end', () => {
        it('should bind actions → mutate state → update getters → notify subscribers', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({
                    items: [] as string[],
                }),
                getters: {
                    count: (state) => state.items.length,
                    hasItems: (state) => state.items.length > 0,
                },
                actions: {
                    addItem(this: any, item: string) {
                        this.items.push(item);
                    },
                    clear(this: any) {
                        this.items = [];
                    },
                },
            });

            const subscriber = vi.fn();
            store.subscribe(subscriber);

            expect(store.count).toBe(0);
            expect(store.hasItems).toBe(false);

            store.addItem('apple');
            expect(store.count).toBe(1);
            expect(store.hasItems).toBe(true);

            store.addItem('banana');
            expect(store.count).toBe(2);

            store.clear();
            expect(store.count).toBe(0);
            expect(store.hasItems).toBe(false);

            expect(subscriber).toHaveBeenCalled();
        });
    });

    describe('store $reset with getters', () => {
        it('should $reset state and getters should recompute', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ value: 10 }),
                getters: {
                    doubled: (state) => state.value * 2,
                },
            });

            store.value = 99;
            expect(store.doubled).toBe(198);

            store.$reset();
            expect(store.value).toBe(10);
            expect(store.doubled).toBe(20);
        });
    });

    describe('nested reactive objects in store', () => {
        it('should reactively track nested state mutations', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({
                    user: { name: 'Alice', address: { city: 'NYC' } },
                }),
                getters: {
                    displayName: (state) => state.user.name.toUpperCase(),
                },
            });

            expect(store.displayName).toBe('ALICE');

            store.state.user.name = 'Bob';
            expect(store.displayName).toBe('BOB');
        });
    });

    describe('multiple stores', () => {
        it('should operate independently', () => {
            const name1 = uniqueName();
            const name2 = uniqueName();

            const store1 = createStore(name1, {
                state: () => ({ count: 0 }),
                actions: {
                    increment(this: any) {
                        this.count++;
                    },
                },
            });

            const store2 = createStore(name2, {
                state: () => ({ count: 100 }),
                actions: {
                    decrement(this: any) {
                        this.count--;
                    },
                },
            });

            store1.increment();
            store2.decrement();

            expect(store1.count).toBe(1);
            expect(store2.count).toBe(99);
        });
    });

    describe('reactive effect cleanup', () => {
        it('should handle effects that access different properties over time', () => {
            const state = createReactive({
                showA: true,
                a: 'hello',
                b: 'world',
            });
            let observed = '';

            reactiveEffect(() => {
                observed = state.showA ? state.a : state.b;
            });

            expect(observed).toBe('hello');

            state.showA = false;
            expect(observed).toBe('world');

            state.b = 'updated';
            expect(observed).toBe('updated');
        });
    });

    describe('watch + store integration', () => {
        it('should watch store state changes', () => {
            const name = uniqueName();
            const store = createStore(name, {
                state: () => ({ count: 0 }),
                actions: {
                    increment(this: any) {
                        this.count++;
                    },
                },
            });

            const values: number[] = [];
            watch(
                () => store.count,
                (val) => values.push(val),
            );

            store.increment();
            store.increment();

            expect(values).toContain(1);
            expect(values).toContain(2);
        });
    });
});
