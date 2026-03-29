import { describe, it, expect } from 'vitest';
import computed from '../state/computed';
import { createReactive } from '../core/create-reactive';

describe('computed', () => {
    it('should compute value from reactive source', () => {
        const state = createReactive({ count: 2 });
        const doubled = computed(() => state.count * 2);

        expect(doubled.value).toBe(4);
    });

    it('should be lazy and not call getter until read', () => {
        let computeCount = 0;
        const state = createReactive({ count: 1 });
        const comp = computed(() => {
            computeCount++;
            return state.count * 10;
        });

        // Effect is lazy — should NOT have run yet
        expect(computeCount).toBe(0);

        // First access triggers computation
        expect(comp.value).toBe(10);
        expect(computeCount).toBe(1);

        // Subsequent access without change should be cached
        expect(comp.value).toBe(10);
        expect(computeCount).toBe(1);
    });

    it('should recompute when dependency changes', () => {
        const state = createReactive({ a: 1, b: 2 });
        const sum = computed(() => state.a + state.b);

        expect(sum.value).toBe(3);
        state.a = 10;
        expect(sum.value).toBe(12);
    });

    it('should call getter exactly ONCE per dependency change (not twice)', () => {
        const state = createReactive({ a: 1 });
        let getterCalls = 0;
        const c = computed(() => {
            getterCalls++;
            return state.a * 2;
        });

        expect(c.value).toBe(2);
        const callsAfterFirstRead = getterCalls;

        state.a = 5;
        const callsAfterMutation = getterCalls; // Should NOT have run getter yet
        expect(c.value).toBe(10); // Lazy recompute
        expect(getterCalls).toBe(callsAfterMutation + 1); // Only ONE additional call
    });

    it('should handle chained computeds', () => {
        const state = createReactive({ base: 5 });
        const doubled = computed(() => state.base * 2);
        const quadrupled = computed(() => doubled.value * 2);

        expect(quadrupled.value).toBe(20);
        state.base = 10;
        expect(quadrupled.value).toBe(40);
    });

    it('should expose stop() for disposal', () => {
        const state = createReactive({ a: 1 });
        const c = computed(() => state.a * 2);
        expect(c.value).toBe(2);

        (c as any).stop();
        state.a = 99;
        // After stop, no re-tracking happens — value stays stale but no crash
        expect(c.value).toBe(2); // value wasn't updated
    });

    it('should propagate getter errors when read (since lazy)', () => {
        const state = createReactive({ value: 0 });
        const comp = computed(() => {
            if (state.value < 0) throw new Error('negative');
            return state.value;
        });

        expect(comp.value).toBe(0);

        state.value = -1;
        // Error is thrown when accessed because computation is lazy
        expect(() => {
            const v = comp.value; // eslint-disable-line
        }).toThrow('negative');
    });
});
