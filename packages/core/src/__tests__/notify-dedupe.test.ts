import { describe, it, expect } from 'vitest';
import { reactive } from '../state/reactive';
import computed from '../state/computed';
import { effect, batchEffects, type EffectRunner } from '../core/effect';
import { createContainer } from '../core/container';
import { defineStore } from '../core/define-store';

/** A chain `{ n: { n: … { v: 0 } } }` of the given depth. */
function chain(depth: number) {
    const root: Record<string, unknown> = {};
    let node = root;
    for (let i = 0; i < depth; i++) {
        node.n = {};
        node = node.n as Record<string, unknown>;
    }
    node.v = 0;
    return root;
}

/** Read every level of the chain, so the effect tracks each ancestor too. */
function readAll(root: Record<string, unknown>, depth: number): number {
    let node = root;
    for (let i = 0; i < depth; i++) node = node.n as Record<string, unknown>;
    return node.v as number;
}

describe('one write runs each effect once', () => {
    for (const depth of [1, 2, 4, 8]) {
        it(`depth ${depth}, unbatched`, () => {
            const state = reactive(chain(depth));
            let runs = 0;
            effect(() => {
                runs++;
                readAll(state, depth);
            });

            runs = 0;
            let node = state as Record<string, unknown>;
            for (let i = 0; i < depth; i++) {
                node = node.n as Record<string, unknown>;
            }
            node.v = 1;

            expect(runs).toBe(1);
        });

        it(`depth ${depth}, batched`, () => {
            const state = reactive(chain(depth));
            let runs = 0;
            effect(() => {
                runs++;
                readAll(state, depth);
            });

            runs = 0;
            batchEffects(() => {
                let node = state as Record<string, unknown>;
                for (let i = 0; i < depth; i++) {
                    node = node.n as Record<string, unknown>;
                }
                node.v = 1;
            });

            expect(runs).toBe(1);
        });
    }

    it('an object shared at two paths still notifies once', () => {
        const shared = { v: 0 };
        const state = reactive({ a: shared, b: shared });
        let runs = 0;
        effect(() => {
            runs++;
            void state.a.v;
            void state.b.v;
        });

        runs = 0;
        state.a.v = 1;

        expect(runs).toBe(1);
    });

    it('a computed over a nested value recomputes once', () => {
        const state = reactive({ user: { profile: { name: 'ada' } } });
        let evaluations = 0;
        const label = computed(() => {
            evaluations++;
            return `${state.user.profile.name}!`;
        });
        let runs = 0;
        effect(() => {
            runs++;
            void label.value;
        });

        evaluations = 0;
        runs = 0;
        state.user.profile.name = 'grace';

        expect(label.value).toBe('grace!');
        expect(evaluations).toBe(1);
        expect(runs).toBe(1);
    });

    it('a store subscriber fires once for a nested write', () => {
        const useStore = defineStore('dedupe_store', {
            state: () => ({ user: { profile: { name: 'ada' } } }),
        });
        const store = useStore(createContainer());
        let calls = 0;
        store.subscribe(() => calls++);

        store.user.profile.name = 'grace';

        expect(calls).toBe(1);
    });

    it('skips an effect stopped by another effect in the same write', () => {
        const state = reactive({ nested: { v: 0 } });
        let secondRuns = 0;
        let second: EffectRunner | null = null;

        effect(() => {
            if (state.nested.v > 0) second?.stop();
        });
        second = effect(() => {
            secondRuns++;
            void state.nested;
        });

        secondRuns = 0;
        state.nested.v = 1;

        expect(secondRuns).toBe(0);
    });
});
