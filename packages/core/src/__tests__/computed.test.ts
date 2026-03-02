import { describe, it, expect } from 'vitest';
import computed from '../state/computed';
import { createReactive } from '../core/create-reactive';

describe('computed', () => {
    it('should compute value from reactive source', () => {
        const state = createReactive({ count: 2 });
        const doubled = computed(() => state.count * 2);

        expect(doubled.value).toBe(4);
    });

    it('should cache value (lazy recompute)', () => {
        let computeCount = 0;
        const state = createReactive({ count: 1 });
        const comp = computed(() => {
            computeCount++;
            return state.count * 10;
        });

        // First access triggers computation
        expect(comp.value).toBe(10);
        const firstComputeCount = computeCount;

        // Subsequent access without change should be cached
        expect(comp.value).toBe(10);
        expect(computeCount).toBe(firstComputeCount);
    });

    it('should recompute when dependency changes', () => {
        const state = createReactive({ a: 1, b: 2 });
        const sum = computed(() => state.a + state.b);

        expect(sum.value).toBe(3);
        state.a = 10;
        expect(sum.value).toBe(12);
    });

    it('should handle chained computeds', () => {
        const state = createReactive({ base: 5 });
        const doubled = computed(() => state.base * 2);
        const quadrupled = computed(() => doubled.value * 2);

        expect(quadrupled.value).toBe(20);
        state.base = 10;
        expect(quadrupled.value).toBe(40);
    });

    it('should work with complex expressions', () => {
        const state = createReactive({
            items: [1, 2, 3, 4, 5],
        });
        const evenCount = computed(
            () => state.items.filter((x: number) => x % 2 === 0).length,
        );

        expect(evenCount.value).toBe(2);
    });

    it('should propagate getter errors through effect', () => {
        const state = createReactive({ value: 0 });
        const comp = computed(() => {
            if (state.value < 0) throw new Error('negative');
            return state.value;
        });

        expect(comp.value).toBe(0);
        // Error is thrown during reactive set because the effect re-runs the getter
        expect(() => {
            state.value = -1;
        }).toThrow('negative');
    });
});
