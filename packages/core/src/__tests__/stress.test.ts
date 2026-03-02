import { describe, it, expect } from 'vitest';
import { createReactive } from '../core/create-reactive';
import { createStore } from '../core/create-store';
import { reactiveEffect } from '../core/effect';
import computed from '../state/computed';

let storeId = 0;
function uniqueName(prefix = 'stress') {
    return `${prefix}_${++storeId}_${Date.now()}`;
}

describe('stress and edge case tests', () => {
    describe('large dataset reactivity', () => {
        it('should handle reactive array with 10,000 items', () => {
            const items = Array.from({ length: 10_000 }, (_, i) => ({
                id: i,
                value: `item_${i}`,
            }));
            const state = createReactive({ items });

            let count = 0;
            reactiveEffect(() => {
                count = state.items.length;
            });

            expect(count).toBe(10_000);

            state.items.push({ id: 10_000, value: 'new' });
            expect(count).toBe(10_001);
        });

        it('should handle computed on large arrays', () => {
            const state = createReactive({
                numbers: Array.from({ length: 5_000 }, (_, i) => i),
            });

            const sum = computed(() =>
                state.numbers.reduce((acc: number, n: number) => acc + n, 0),
            );

            expect(sum.value).toBe((4999 * 5000) / 2);
        });

        it('should handle store with many properties', () => {
            const name = uniqueName();
            const initialState: Record<string, number> = {};
            for (let i = 0; i < 1_000; i++) {
                initialState[`prop_${i}`] = i;
            }

            const store = createStore(name, {
                state: () => initialState,
            });

            expect(store.prop_0).toBe(0);
            expect(store.prop_999).toBe(999);

            store.prop_500 = 9999;
            expect(store.prop_500).toBe(9999);
        });
    });

    describe('deeply nested objects', () => {
        it('should handle 10 levels of nesting', () => {
            let obj: any = { value: 'deep' };
            for (let i = 0; i < 10; i++) {
                obj = { nested: obj };
            }

            const state = createReactive(obj);
            let current: any = state;
            for (let i = 0; i < 10; i++) {
                current = current.nested;
            }
            expect(current.value).toBe('deep');
        });
    });

    describe('edge cases', () => {
        it('should handle empty object', () => {
            const state = createReactive({});
            expect(Object.keys(state)).toEqual([]);
        });

        it('should handle empty array', () => {
            const arr = createReactive([]);
            expect(arr.length).toBe(0);
            arr.push(1);
            expect(arr.length).toBe(1);
        });

        it('should handle object with symbol keys', () => {
            const sym = Symbol('test');
            const state = createReactive({ [sym]: 42 });
            expect(state[sym]).toBe(42);
        });

        it('should handle mixed type values', () => {
            const state = createReactive({
                num: 42,
                str: 'hello',
                bool: true,
                nuull: null,
                undef: undefined,
                arr: [1, 2, 3],
                obj: { a: 1 },
            });

            expect(state.num).toBe(42);
            expect(state.str).toBe('hello');
            expect(state.bool).toBe(true);
            expect(state.nuull).toBe(null);
            expect(state.undef).toBe(undefined);
            expect(state.arr.length).toBe(3);
            expect(state.obj.a).toBe(1);
        });

        it('should handle rapid successive mutations', () => {
            const state = createReactive({ count: 0 });
            let observed = 0;

            reactiveEffect(() => {
                observed = state.count;
            });

            for (let i = 1; i <= 100; i++) {
                state.count = i;
            }

            expect(observed).toBe(100);
        });

        it('should handle setting property to same object reference', () => {
            const inner = { x: 1 };
            const state = createReactive({ inner });
            let callCount = 0;

            reactiveEffect(() => {
                void state.inner;
                callCount++;
            });

            const initial = callCount;
            state.inner = inner; // same reference
            expect(callCount).toBe(initial); // should not trigger
        });
    });

    describe('boundary values', () => {
        it('should handle Infinity', () => {
            const state = createReactive({ value: Infinity });
            expect(state.value).toBe(Infinity);
            state.value = -Infinity;
            expect(state.value).toBe(-Infinity);
        });

        it('should handle very large numbers', () => {
            const state = createReactive({
                value: Number.MAX_SAFE_INTEGER,
            });
            expect(state.value).toBe(Number.MAX_SAFE_INTEGER);
        });

        it('should handle empty string', () => {
            const state = createReactive({ value: '' });
            expect(state.value).toBe('');
        });

        it('should handle BigInt-like boundary (as number)', () => {
            const state = createReactive({ value: 0 });
            state.value = Number.MAX_SAFE_INTEGER;
            expect(state.value).toBe(Number.MAX_SAFE_INTEGER);
        });
    });
});
