import { describe, it, expect } from 'vitest';
import { reactive } from '../state/reactive';
import { effect, type EffectRunner } from '../core/effect';

describe('effect subscriptions across runs', () => {
    it('releases a dependency a later run no longer reads', () => {
        const state = reactive({ useA: true, a: 0, b: 0 });
        let runs = 0;
        effect(() => {
            runs++;
            void (state.useA ? state.a : state.b);
        });

        state.useA = false;
        runs = 0;
        state.a = 1; // no longer read

        expect(runs).toBe(0);
        state.b = 1;
        expect(runs).toBe(1);
    });

    it('picks up a dependency a later run starts reading', () => {
        const state = reactive({ useA: false, a: 0, b: 0 });
        let runs = 0;
        effect(() => {
            runs++;
            void (state.useA ? state.a : state.b);
        });

        state.useA = true;
        runs = 0;
        state.a = 1;

        expect(runs).toBe(1);
    });

    it('lets an effect write a value before reading it', () => {
        const state = reactive({ trigger: 0, value: 0 });
        const seen: number[] = [];
        effect(() => {
            void state.trigger;
            state.value = 0;
            seen.push(state.value);
        });

        expect(() => {
            state.trigger++;
        }).not.toThrow();
        expect(seen).toEqual([0, 0]);
    });

    it('still reports an effect that writes a value it has read', () => {
        const state = reactive({ n: 0 });
        expect(() =>
            effect(() => {
                state.n = state.n + 1;
            }),
        ).toThrow(/Circular dependency/);
    });

    it('releases dependencies not reached when a run throws', () => {
        const state = reactive({ fail: false, a: 0 });
        let runs = 0;
        effect(() => {
            runs++;
            if (state.fail) throw new Error('stop');
            void state.a;
        });

        expect(() => {
            state.fail = true;
        }).toThrow('stop');
        runs = 0;
        state.a = 1;

        expect(runs).toBe(0);
    });

    it('does not resubscribe an effect that stopped itself mid-run', () => {
        const state = reactive({ go: 0, later: 0 });
        let runs = 0;
        let runner: EffectRunner | null = null;
        runner = effect(() => {
            runs++;
            if (state.go > 0) runner?.stop();
            void state.later;
        });

        state.go = 1;
        runs = 0;
        state.later = 1;

        expect(runs).toBe(0);
    });
});
