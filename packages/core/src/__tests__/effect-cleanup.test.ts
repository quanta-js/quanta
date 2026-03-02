/**
 * Regression tests for the effect dependency cleanup fix.
 *
 * These tests verify that reactive effects properly clean up old dependency
 * subscriptions when re-running, preventing unbounded subscriber accumulation
 * (the root cause of the exponential slowdown in the vanilla cart demo).
 *
 * Tests verify cleanup through observable behavior (run counts, timing,
 * branch switching) rather than internal targetMap inspection.
 */
import { describe, it, expect } from 'vitest';
import { createReactive } from '../core/create-reactive';
import { reactiveEffect } from '../core/effect';
import { createStore } from '../core/create-store';

let storeId = 0;
function uniqueName(prefix = 'regression') {
    return `${prefix}_${++storeId}_${Date.now()}`;
}

describe('effect dependency cleanup', () => {
    it('should not accumulate subscriber re-runs over many mutations', () => {
        const state = createReactive({ count: 0 });
        let runCount = 0;

        reactiveEffect(() => {
            void state.count;
            runCount++;
        });

        expect(runCount).toBe(1);

        // Trigger 50 mutations — each should cause exactly 1 re-run
        for (let i = 1; i <= 50; i++) {
            state.count = i;
        }

        // Should be exactly 51 (1 initial + 50 mutations), not 1+2+3+...+50
        expect(runCount).toBe(51);
    });

    it('should stop tracking stale dependencies after branch switch', () => {
        const state = createReactive({ toggle: true, a: 'hello', b: 'world' });
        let observed = '';
        let effectRuns = 0;

        reactiveEffect(() => {
            effectRuns++;
            observed = state.toggle ? state.a : state.b;
        });

        expect(observed).toBe('hello');
        expect(effectRuns).toBe(1);

        // Switch branch — now reads `b`, no longer reads `a`
        state.toggle = false;
        expect(observed).toBe('world');

        const runsAfterSwitch = effectRuns;

        // Mutating `a` should NOT retrigger the effect since we switched to `b`
        state.a = 'changed';
        expect(effectRuns).toBe(runsAfterSwitch); // no new runs
        expect(observed).toBe('world'); // unchanged

        // Mutating `b` SHOULD retrigger
        state.b = 'updated';
        expect(observed).toBe('updated');
        expect(effectRuns).toBe(runsAfterSwitch + 1);
    });

    it('should handle rapid mutations with constant-time per mutation', () => {
        const state = createReactive({ value: 0 });
        let effectRuns = 0;

        reactiveEffect(() => {
            void state.value;
            effectRuns++;
        });

        // Measure time for first 100 mutations
        const start1 = performance.now();
        for (let i = 1; i <= 100; i++) {
            state.value = i;
        }
        const time1 = performance.now() - start1;

        expect(effectRuns).toBe(101);

        // Measure time for next 100 mutations
        const start2 = performance.now();
        for (let i = 101; i <= 200; i++) {
            state.value = i;
        }
        const time2 = performance.now() - start2;

        expect(effectRuns).toBe(201);

        // Without cleanup, time2 >> time1 due to accumulated subscribers.
        // With cleanup, time2 ≈ time1. Allow 5x + 10ms tolerance for CI variability.
        expect(time2).toBeLessThan(time1 * 5 + 10);
    });

    it('should track multiple properties without growing subscriber count', () => {
        const state = createReactive({ a: 1, b: 2, c: 3 });
        const results: number[] = [];

        reactiveEffect(() => {
            results.push(state.a + state.b + state.c);
        });

        expect(results).toEqual([6]);

        // Mutate each property — each should trigger exactly 1 recalc
        state.a = 10;
        expect(results).toEqual([6, 15]);

        state.b = 20;
        expect(results).toEqual([6, 15, 33]);

        state.c = 30;
        expect(results).toEqual([6, 15, 33, 60]);

        // After 3 mutations + 1 initial, exactly 4 effect runs
        expect(results.length).toBe(4);
    });

    it('should handle conditional property access correctly', () => {
        const state = createReactive({ show: true, x: 10, y: 20 });
        let result = 0;
        let runs = 0;

        reactiveEffect(() => {
            runs++;
            result = state.show ? state.x : state.y;
        });

        expect(result).toBe(10);
        expect(runs).toBe(1);

        // Change x — should trigger because show=true means we're reading x
        state.x = 100;
        expect(result).toBe(100);
        expect(runs).toBe(2);

        // Change y — should NOT trigger because we're in the x branch
        state.y = 200;
        expect(result).toBe(100);
        expect(runs).toBe(2);

        // Switch branch
        state.show = false;
        expect(result).toBe(200);

        const runsAfterSwitch = runs;

        // Now x should NOT trigger
        state.x = 999;
        expect(runs).toBe(runsAfterSwitch);
        expect(result).toBe(200);

        // But y SHOULD trigger
        state.y = 300;
        expect(result).toBe(300);
    });

    it('should not leak via store.subscribe pattern (how React binds)', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ items: [] as number[], total: 0 }),
            actions: {
                addItem(this: any, n: number) {
                    this.items = [...this.items, n];
                    this.total = this.items.reduce(
                        (s: number, x: number) => s + x,
                        0,
                    );
                },
            },
        });

        const observed: number[] = [];
        const unsub = store.subscribe(() => {
            observed.push(store.total);
        });

        // Rapidly add 30 items
        for (let i = 1; i <= 30; i++) {
            store.addItem(i);
        }

        const expectedTotal = (30 * 31) / 2; // 465
        expect(store.total).toBe(expectedTotal);
        expect(observed).toContain(expectedTotal);
        unsub();
    });

    it('should handle effects that dynamically change tracked object', () => {
        const obj1 = createReactive({ value: 'A' });
        const obj2 = createReactive({ value: 'B' });
        const selector = createReactive({ useFirst: true });
        let observed = '';
        let runs = 0;

        reactiveEffect(() => {
            runs++;
            observed = selector.useFirst ? obj1.value : obj2.value;
        });

        expect(observed).toBe('A');
        expect(runs).toBe(1);

        // Mutating obj2 should NOT trigger (we're reading obj1)
        obj2.value = 'B2';
        expect(runs).toBe(1);

        // Switch to obj2
        selector.useFirst = false;
        expect(observed).toBe('B2');

        const runsAfterSwitch = runs;

        // obj1 should no longer trigger
        obj1.value = 'A2';
        expect(runs).toBe(runsAfterSwitch);

        // obj2 SHOULD trigger
        obj2.value = 'B3';
        expect(observed).toBe('B3');
    });
});
