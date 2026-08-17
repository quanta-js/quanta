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
): void {
    try {
        // Breadth-first over the ancestor DAG. An object can sit at several
        // paths at once (shared instances), so this is a graph walk, not a
        // simple parent chain.
        const queue: object[] = [target];
        const visited = new Set<object>([target]);

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
