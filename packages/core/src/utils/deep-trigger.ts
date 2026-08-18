import { logger } from '../services/logger-service';
import { __DEV__ } from '../utils/env';
import type { Dependency } from '../core/dependency';

/**
 * Child object -> the (parent, key) slots it currently occupies.
 *
 * Deep reactivity works by bubbling: mutating `state.user.address.city` must
 * also invalidate anything watching `state.user` or `state`. To do that we
 * need to walk *upwards*, which the object graph itself does not support, so
 * this map records the reverse edges.
 *
 * The value is a `Map<parent, Set<key>>` rather than a flat list of
 * `{parent, key}` records. The previous flat-`Set` shape required a linear
 * scan on every nested property read to avoid inserting duplicates, and it
 * allocated a fresh record object per edge.
 *
 * Note the memory contract: the outer map is weak on the child, but a parent
 * is strongly held by its child's entry. That is only sound because we prune
 * the edge the moment a child is detached (see {@link removeParent}) — a stale
 * edge would keep a dead subtree alive *and* deliver phantom invalidations to
 * a parent the child no longer belongs to.
 */
const parentMap = new WeakMap<object, Map<object, Set<string | symbol>>>();

/**
 * A per-object "something in here changed" channel.
 *
 * Subscribing to it costs one dependency for the whole object and stays O(1)
 * as the object grows, where subscribing per key costs one dependency per key
 * *and* re-registers every one of them on each notification.
 *
 * Declared in this module rather than beside `ITERATE_KEY` because both
 * `effect.ts` and `create-reactive.ts` need it, and this is the only one of
 * the three with no imports from the other two — putting it anywhere else
 * closes an import cycle.
 */
export const ANY_CHANGE = Symbol('quanta.any');

/**
 * How far the allocation-free linear walk will go before handing over to the
 * full graph walk.
 *
 * Without a visited set the fast path cannot detect a cycle, so it is bounded
 * instead. State nested deeper than this is rare enough that the extra
 * allocations do not matter.
 */
const LINEAR_FAST_PATH_MAX_DEPTH = 32;

export { parentMap };

/**
 * Record that `child` currently sits at `parent[key]`.
 *
 * Idempotent, and O(1) — the nested Map/Set shape means re-reading the same
 * nested property (which happens on every render) does no scanning work.
 */
export function setParent(
    child: object,
    parent: object,
    key: string | symbol,
): void {
    // A self-edge would make the bubble walk cycle immediately.
    if (child === parent) return;

    let parents = parentMap.get(child);
    if (parents === undefined) {
        parents = new Map();
        parentMap.set(child, parents);
    }

    let keys = parents.get(parent);
    if (keys === undefined) {
        keys = new Set();
        parents.set(parent, keys);
    }
    keys.add(key);
}

/**
 * Remove the `parent[key] -> child` edge.
 *
 * Must be called whenever a slot stops pointing at a child — on reassignment
 * and on delete. Skipping it was the cause of two distinct bugs: mutating a
 * detached object still woke effects subscribed to its former location, and
 * the detached child kept its former parent reachable forever.
 *
 * @param child  - The object being detached. Non-objects are ignored.
 * @param parent - The container it is leaving.
 * @param key    - The slot it occupied.
 */
export function removeParent(
    child: unknown,
    parent: object,
    key: string | symbol,
): void {
    if (child === null || typeof child !== 'object') return;

    const parents = parentMap.get(child as object);
    if (parents === undefined) return;

    const keys = parents.get(parent);
    if (keys === undefined) return;

    keys.delete(key);
    if (keys.size === 0) parents.delete(parent);
    if (parents.size === 0) parentMap.delete(child as object);
}

/**
 * Walk upwards from `target`, notifying each ancestor's dependency for the key
 * the child occupies.
 *
 * @param target    - The object that changed.
 * @param targetMap - The global target -> (key -> Dependency) map.
 * @param notify    - Notification sink. Injected rather than imported so that
 *                    this module stays free of a cycle with `core/effect.ts`,
 *                    and — more importantly — so bubbled notifications go
 *                    through the *same* batching and scheduler-aware path as
 *                    direct ones.
 */
export function bubbleTrigger(
    target: object,
    targetMap: WeakMap<object, Map<string | symbol, Dependency>>,
    notify: (dep: Dependency) => void,
    notifyAnyChange = false,
): void {
    try {
        // Fast path: a strictly linear chain — every node has exactly one
        // parent holding it at exactly one key. That is the shape of virtually
        // all application state, and it needs no queue, no visited set and no
        // dedupe set, because a linear walk cannot revisit a node or reach the
        // same dependency twice.
        //
        // The full graph walk below exists for shared subtrees, which are
        // legal and must stay correct; this just stops every ordinary nested
        // write paying for machinery only they need. The depth cap is a cycle
        // guard: without a visited set, a cycle would spin here forever.
        let node: object = target;
        for (let depth = 0; depth < LINEAR_FAST_PATH_MAX_DEPTH; depth++) {
            const parents = parentMap.get(node);
            if (parents === undefined || parents.size === 0) return; // done
            if (parents.size > 1) break; // branching — fall back

            const [parent, keys] = parents.entries().next().value!;
            if (keys.size > 1) break; // one object at several keys — fall back

            const parentDeps = targetMap.get(parent);
            if (parentDeps !== undefined) {
                if (notifyAnyChange) {
                    const anyDep = parentDeps.get(ANY_CHANGE);
                    if (anyDep !== undefined) notify(anyDep);
                }
                const key = keys.values().next().value!;
                const dep = parentDeps.get(key);
                if (dep !== undefined) notify(dep);
            }
            node = parent;
        }

        // Breadth-first over the ancestor DAG. An object can sit at several
        // paths at once (shared instances), so this is a graph walk, not a
        // simple parent chain.
        const queue: object[] = [node];
        const visited = new Set<object>([node]);

        // A single Dependency can be reachable through several edges — a
        // diamond in the ownership graph, or one object stored at two keys of
        // the same parent. Notifying it once per edge would run its effects
        // several times for one logical change, so dedupe across the walk.
        const notified = new Set<Dependency>();

        // `queue.shift()` is O(n) on large arrays; an index cursor keeps the
        // walk linear.
        for (let cursor = 0; cursor < queue.length; cursor++) {
            const current = queue[cursor];

            const parents = parentMap.get(current);
            if (parents === undefined) continue; // reached a root

            for (const [parent, keys] of parents) {
                const parentDeps = targetMap.get(parent);
                if (parentDeps !== undefined) {
                    // Coarse channel for this ancestor, so a subscriber to the
                    // whole subtree costs one dependency instead of one per key.
                    if (notifyAnyChange) {
                        const anyDep = parentDeps.get(ANY_CHANGE);
                        if (anyDep !== undefined && !notified.has(anyDep)) {
                            notified.add(anyDep);
                            notify(anyDep);
                        }
                    }
                    for (const key of keys) {
                        const dep = parentDeps.get(key);
                        if (dep !== undefined && !notified.has(dep)) {
                            notified.add(dep);
                            notify(dep);
                        }
                    }
                }

                if (!visited.has(parent)) {
                    visited.add(parent);
                    queue.push(parent);
                }
            }
        }
    } catch (error) {
        // Bubbling is best-effort enrichment of a trigger that has already
        // been delivered to its direct subscribers. Failing here must not
        // abort the caller's mutation.
        if (__DEV__) {
            logger.error(
                `DeepTrigger: bubble failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }
}

/**
 * The chain of ancestors above `target`, root-first.
 *
 * Where an object has multiple parents the first recorded edge is followed, so
 * this represents one representative path rather than the full graph. Used by
 * DevTools to render a human-readable mutation path.
 */
export function getParentChain(
    target: object,
): Array<{ key: string | symbol; parent: object }> {
    const chain: Array<{ key: string | symbol; parent: object }> = [];
    const seen = new Set<object>();
    let current = target;

    while (!seen.has(current)) {
        seen.add(current);
        const parents = parentMap.get(current);
        if (parents === undefined || parents.size === 0) break;

        const [parent, keys] = parents.entries().next().value!;
        const key = keys.values().next().value;
        if (key === undefined) break;

        chain.push({ key, parent });
        current = parent;
    }

    return chain.reverse();
}
