import { logger } from '../services/logger-service';
import { Dependency } from '../core/dependency';

const parentMap = new WeakMap<
    object,
    Set<{ parent: object; key: string | symbol }>
>();

export { parentMap };

/**
 * Set the parent mapping for a reactive child object.
 * Objects can exist at multiple paths (shared instances).
 */
export function setParent(
    child: object,
    parent: object,
    key: string | symbol,
): void {
    let parents = parentMap.get(child);
    if (!parents) {
        parents = new Set();
        parentMap.set(child, parents);
    }
    // Prevent duplicate entries for the same parent+key combination
    for (const mapping of parents) {
        if (mapping.parent === parent && mapping.key === key) return;
    }
    parents.add({ parent, key });
}

// Bubbles: Triggers parent deps on mutation
export function bubbleTrigger(
    target: object,
    prop: string | symbol,
    targetMap: WeakMap<object, Map<string | symbol, Dependency>>,
): void {
    try {
        const queue: object[] = [target];
        const visited = new Set<object>();

        while (queue.length > 0) {
            const current = queue.shift()!;

            if (visited.has(current)) {
                continue; // Cycle detected: stop exploring this branch
            }
            visited.add(current);

            const parents = parentMap.get(current);
            if (!parents) continue; // Root reached

            for (const { parent, key } of parents) {
                if (parent === current) continue; // Self-ref guard

                // Notify parent's dep for this child key
                const parentDeps = targetMap.get(parent);
                const dep = parentDeps?.get(key);
                if (dep) {
                    dep.notify();
                }

                // Add parent to the queue to continue bubbling up
                queue.push(parent);
            }
        }
    } catch (error) {
        logger.error(
            `DeepTrigger: Bubble failed for ${String(prop)}: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

// Expose for manual deep triggers
export function getParentChain(
    target: object,
): Array<{ key: string | symbol; parent: object }> {
    const chain: Array<{ key: string | symbol; parent: object }> = [];
    let current = target;
    while (true) {
        const parents = parentMap.get(current);
        if (!parents || parents.size === 0) break;
        // In case of multiple parents, we just pick the first one for the direct chain
        const info = parents.values().next().value;
        if (!info) break;
        chain.push(info);
        current = info.parent;
    }
    return chain.reverse();
}
