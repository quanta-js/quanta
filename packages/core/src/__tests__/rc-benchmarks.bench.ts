import { bench, describe } from 'vitest';
import { createStore } from '../core/create-store';
import { reactive } from '../state/reactive';
import computed from '../state/computed';

describe('RC benchmarks', () => {
    bench('10k flat property writes', () => {
        const state = reactive({ count: 0 });
        for (let i = 0; i < 10000; i++) {
            state.count++;
        }
    });

    bench('1k deep nested writes (depth 10)', () => {
        const obj: any = {};
        let head = obj;
        for (let i = 0; i < 10; i++) {
            head.next = {};
            head = head.next;
        }
        const state = reactive(obj);
        for (let i = 0; i < 1000; i++) {
            state.next.next.next.next.next.next.next.next.next.value = i;
        }
    });

    bench('100 computed chain fan-out', () => {
        const state = reactive({ base: 0 });
        const computeds = Array.from({ length: 100 }, (_, i) =>
            computed(() => state.base * i),
        );
        state.base++;
        computeds.forEach((c) => c.value);
    });

    bench('create/destroy 100 stores', () => {
        for (let i = 0; i < 100; i++) {
            const store = createStore(`bench_${i}_${Date.now()}`, {
                state: () => ({ count: 0 }),
            });
            store.$destroy();
        }
    });

    bench('1k subscribers × 100 updates', () => {
        const state = reactive({ val: 0 });
        let calls = 0;
        const subs = Array.from({ length: 1000 }, () =>
            computed(() => {
                calls++;
                return state.val;
            }),
        );
        // Initial evaluation to subscribe
        subs.forEach((c) => c.value);
        for (let i = 0; i < 100; i++) {
            state.val++;
            subs.forEach((c) => c.value);
        }
    });
});
