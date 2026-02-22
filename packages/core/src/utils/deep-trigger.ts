import { logger } from '../services/logger-service';
import { Dependency } from '../core/dependency';

const parentMap = new WeakMap<
    object,
    { parent: object; key: string | symbol }
>();

export { parentMap };

/**
 * Set the parent mapping for a reactive child object.
 * Warns in dev mode if the object is referenced from multiple parents,
 * as only the last parent will receive bubble triggers.
 */
export function setParent(
    child: object,
    parent: object,
    key: string | symbol,
): void {
    if (parentMap.has(child)) {
        const existing = parentMap.get(child)!;
        if (existing.parent !== parent) {
            logger.warn(
                `Reactive: Object at "${String(key)}" is referenced from multiple parents. Only the last parent will receive bubble triggers.`,
            );
        }
    }
    parentMap.set(child, { parent, key });
}

// Bubbles: Triggers parent deps on mutation
export function bubbleTrigger(
    target: object,
    prop: string | symbol,
    targetMap: WeakMap<object, Map<string | symbol, Dependency>>,
): void {
    try {
        let current = target;
        const visited = new Set<object>();

        while (true) {
            if (visited.has(current)) {
                logger.warn(
                    `DeepTrigger: Cycle detected in bubble chain from ${String(prop)}`,
                );
                break;
            }
            visited.add(current);

            const info = parentMap.get(current);
            if (!info) break; // Root reached

            const { parent, key } = info;
            if (parent === current) break; // Self-ref guard

            // Notify parent's dep for this child key
            const parentDeps = targetMap.get(parent);
            const dep = parentDeps?.get(key);
            if (dep) {
                dep.notify();
            }

            current = parent;
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
        const info = parentMap.get(current);
        if (!info) break;
        chain.push(info);
        current = info.parent;
    }
    return chain.reverse();
}
