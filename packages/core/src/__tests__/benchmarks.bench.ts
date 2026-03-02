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

    bench('read computed (cached)', () => {
        const state = createReactive({ a: 1, b: 2 });
        const sum = computed(() => state.a + state.b);
        void sum.value;
        void sum.value; // should be cached
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
