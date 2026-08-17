import { bench, describe } from 'vitest';
import { createReactive } from '../core/create-reactive';
import { reactiveEffect } from '../core/effect';
import computed from '../state/computed';
import { createStore } from '../core/create-store';

let benchStoreId = 0;
function uniqueName() {
    return `bench_${++benchStoreId}_${Date.now()}`;
}

describe('reactive creation', () => {
    bench('create reactive object (small)', () => {
        createReactive({ a: 1, b: 2, c: 3 });
    });

    bench('create reactive object (medium - 50 props)', () => {
        const obj: Record<string, number> = {};
        for (let i = 0; i < 50; i++) obj[`prop${i}`] = i;
        createReactive(obj);
    });

    bench('create reactive array (1000 items)', () => {
        createReactive(Array.from({ length: 1000 }, (_, i) => i));
    });
});

describe('property access (tracked)', () => {
    const state = createReactive({ count: 0 });

    bench('read reactive property', () => {
        void state.count;
    });

    bench('write reactive property', () => {
        state.count++;
    });
});

describe('effect execution', () => {
    bench('create + run effect', () => {
        const state = createReactive({ x: 0 });
        reactiveEffect(() => {
            void state.x;
        });
    });

    bench('trigger effect (single dependency)', () => {
        const state = createReactive({ x: 0 });
        reactiveEffect(() => {
            void state.x;
        });
        state.x = Math.random();
    });
});

describe('computed performance', () => {
    bench('create computed', () => {
        const state = createReactive({ a: 1, b: 2 });
        computed(() => state.a + state.b);
    });

    // The previous version of this benchmark rebuilt the reactive object AND
    // the computed on every iteration, so it measured construction cost while
    // being named "cached read". Hoist the setup so the measured body is only
    // the thing under test.
    const cachedState = createReactive({ a: 1, b: 2 });
    const cachedSum = computed(() => cachedState.a + cachedState.b);
    void cachedSum.value; // warm the cache once, outside the measurement

    bench('read computed (cached) x1000', () => {
        for (let i = 0; i < 1000; i++) void cachedSum.value;
    });

    const plainState = createReactive({ a: 1, b: 2 });
    bench('read plain reactive property x1000 (baseline)', () => {
        for (let i = 0; i < 1000; i++) void plainState.a;
    });

    bench('computed invalidate + recompute', () => {
        cachedState.a = cachedState.a + 1;
        void cachedSum.value;
    });
});

describe('store operations', () => {
    bench('create store', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0 }),
            getters: {
                doubled: (s) => s.count * 2,
            },
            actions: {
                increment(this: any) {
                    this.count++;
                },
            },
        });
        store.$destroy!();
    });

    bench('store action dispatch', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0 }),
            actions: {
                increment(this: any) {
                    this.count++;
                },
            },
        });
        store.increment();
        store.$destroy!();
    });
});
