import { describe, it, expect, vi } from 'vitest';
import {
    parentMap,
    setParent,
    removeParent,
    bubbleTrigger,
    getParentChain,
} from '../utils/deep-trigger';
import { Dependency } from '../core/dependency';
import { reactive } from '../state';
import { reactiveEffect } from '../core/effect';

type TargetMap = WeakMap<object, Map<string | symbol, Dependency>>;

/** Build a targetMap with one dependency registered at `parent[key]`. */
function depAt(parent: object, key: string | symbol) {
    const dep = new Dependency();
    const callback = vi.fn();
    dep.depend(callback);
    const targetMap: TargetMap = new WeakMap();
    targetMap.set(parent, new Map([[key, dep]]));
    return { dep, callback, targetMap };
}

/** Collect notified deps rather than actually running effects. */
const collect = (seen: Dependency[]) => (dep: Dependency) => {
    seen.push(dep);
    for (const subscriber of [...dep.getSubscribers]) subscriber();
};

describe('deep-trigger', () => {
    describe('setParent', () => {
        it('records the (parent, key) slot a child occupies', () => {
            const child = {};
            const parent = {};

            setParent(child, parent, 'key');

            const parents = parentMap.get(child)!;
            expect(parents.get(parent)).toEqual(new Set(['key']));
        });

        it('records every slot when a child is shared across parents', () => {
            const child = {};
            const first = {};
            const second = {};

            setParent(child, first, 'a');
            setParent(child, second, 'b');

            const parents = parentMap.get(child)!;
            expect(parents.size).toBe(2);
            expect(parents.get(first)).toEqual(new Set(['a']));
            expect(parents.get(second)).toEqual(new Set(['b']));
        });

        it('is idempotent for a repeated (parent, key) pair', () => {
            // Nested reads re-register the same edge constantly; the nested
            // Map/Set shape makes that O(1) and duplicate-free.
            const child = {};
            const parent = {};

            setParent(child, parent, 'k');
            setParent(child, parent, 'k');
            setParent(child, parent, 'k');

            expect(parentMap.get(child)!.get(parent)!.size).toBe(1);
        });

        it('refuses a self-edge, which would cycle the bubble walk', () => {
            const node = {};
            setParent(node, node, 'self');
            expect(parentMap.has(node)).toBe(false);
        });
    });

    describe('removeParent', () => {
        it('drops the edge and prunes empty containers', () => {
            const child = {};
            const parent = {};

            setParent(child, parent, 'k');
            removeParent(child, parent, 'k');

            expect(parentMap.has(child)).toBe(false);
        });

        it('keeps sibling edges intact', () => {
            const child = {};
            const parent = {};

            setParent(child, parent, 'a');
            setParent(child, parent, 'b');
            removeParent(child, parent, 'a');

            expect(parentMap.get(child)!.get(parent)).toEqual(new Set(['b']));
        });

        it('ignores primitives and unknown edges', () => {
            expect(() => removeParent(42, {}, 'k')).not.toThrow();
            expect(() => removeParent(null, {}, 'k')).not.toThrow();
            expect(() => removeParent({}, {}, 'k')).not.toThrow();
        });
    });

    describe('bubbleTrigger', () => {
        it('notifies the ancestor dependency for the slot the child occupies', () => {
            const child = {};
            const parent = {};
            const { callback, targetMap } = depAt(parent, 'childKey');

            setParent(child, parent, 'childKey');
            bubbleTrigger(child, targetMap, collect([]));

            expect(callback).toHaveBeenCalled();
        });

        it('walks the whole ancestor chain, not just the direct parent', () => {
            const root = {};
            const middle = {};
            const leaf = {};

            const rootDep = new Dependency();
            const middleDep = new Dependency();
            const targetMap: TargetMap = new WeakMap();
            targetMap.set(root, new Map([['mid', rootDep]]));
            targetMap.set(middle, new Map([['leaf', middleDep]]));

            setParent(middle, root, 'mid');
            setParent(leaf, middle, 'leaf');

            const seen: Dependency[] = [];
            bubbleTrigger(leaf, targetMap, collect(seen));

            expect(seen).toContain(middleDep);
            expect(seen).toContain(rootDep);
        });

        it('notifies a shared child through every parent it belongs to', () => {
            const shared = {};
            const first = {};
            const second = {};

            const firstDep = new Dependency();
            const secondDep = new Dependency();
            const targetMap: TargetMap = new WeakMap();
            targetMap.set(first, new Map([['x', firstDep]]));
            targetMap.set(second, new Map([['y', secondDep]]));

            setParent(shared, first, 'x');
            setParent(shared, second, 'y');

            const seen: Dependency[] = [];
            bubbleTrigger(shared, targetMap, collect(seen));

            expect(seen).toEqual(expect.arrayContaining([firstDep, secondDep]));
        });

        it('terminates on a cyclic parent graph', () => {
            const a = {};
            const b = {};
            setParent(a, b, 'toB');
            setParent(b, a, 'toA');

            const targetMap: TargetMap = new WeakMap();
            expect(() =>
                bubbleTrigger(a, targetMap, collect([])),
            ).not.toThrow();
        });

        it('visits each ancestor once even in a diamond graph', () => {
            //     top
            //    /   \
            //  left  right
            //    \   /
            //     leaf
            const top = {};
            const left = {};
            const right = {};
            const leaf = {};

            const topDep = new Dependency();
            const targetMap: TargetMap = new WeakMap();
            targetMap.set(top, new Map([['l', topDep]]));

            setParent(left, top, 'l');
            setParent(right, top, 'l');
            setParent(leaf, left, 'a');
            setParent(leaf, right, 'b');

            const seen: Dependency[] = [];
            bubbleTrigger(leaf, targetMap, collect(seen));

            // `top` is reachable via two paths but must be enqueued once.
            expect(seen.filter((d) => d === topDep)).toHaveLength(1);
        });
    });

    describe('getParentChain', () => {
        it('is empty for a root object', () => {
            expect(getParentChain({})).toEqual([]);
        });

        it('returns the chain root-first', () => {
            const root = {};
            const middle = {};
            const leaf = {};

            setParent(middle, root, 'mid');
            setParent(leaf, middle, 'leaf');

            const chain = getParentChain(leaf);
            expect(chain.map((link) => link.key)).toEqual(['mid', 'leaf']);
        });

        it('terminates on a cycle instead of hanging', () => {
            const a = {};
            const b = {};
            setParent(a, b, 'toB');
            setParent(b, a, 'toA');
            expect(() => getParentChain(a)).not.toThrow();
        });
    });

    describe('integration: detached children stop bubbling', () => {
        it('does not invalidate the old parent after reassignment', () => {
            const state = reactive<{ child: { v: number } }>({
                child: { v: 0 },
            });

            let runs = 0;
            reactiveEffect(() => {
                void state.child.v;
                runs++;
            });

            const detached = state.child;
            state.child = { v: 100 };
            const baseline = runs;

            detached.v = 999;

            expect(runs).toBe(baseline);
        });

        it('does not invalidate the old parent after delete', () => {
            const state = reactive<{ child?: { v: number } }>({
                child: { v: 0 },
            });

            let runs = 0;
            reactiveEffect(() => {
                void state.child?.v;
                runs++;
            });

            const detached = state.child!;
            delete state.child;
            const baseline = runs;

            detached.v = 42;

            expect(runs).toBe(baseline);
        });
    });
});
