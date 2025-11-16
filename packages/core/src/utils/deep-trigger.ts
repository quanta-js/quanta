import { logger } from '../services/logger-service';
import { Dependency } from '../core/dependency';

const parentMap = new WeakMap<
    object,
    { parent: object; key: string | symbol }
>();

export { parentMap };

// Bubbl: Triggers parent deps on mutation
export function bubbleTrigger(
    target: object,
    prop: string | symbol,
    targetMap: WeakMap<object, Record<string | symbol, Dependency>>, // Injected for deps access
): void {
    logger.debug(
        `DeepTrigger: Entry - Bubbling from ${String(prop)} on ${String(target)}`,
    );
    try {
        let current = target;
        const visited = new Set<object>(); // Cycle guard

        while (true) {
            if (visited.has(current)) {
                logger.warn(
                    `DeepTrigger: Cycle detected in bubble chain from ${String(prop)}`,
                );
                break;
            }
            visited.add(current);

            const info = parentMap.get(current);
            logger.debug(
                `DeepTrigger: Checking parent for ${String(current)}: ${!!info ? 'Found' : 'None'}`,
            );
            if (!info) break; // Root reached

            const { parent, key } = info;
            if (parent === current) break; // Self-ref guard

            // Notify parent's dep for this child key
            const parentDeps = targetMap.get(parent);
            const hasDep = parentDeps?.[key] ? 'Yes' : 'No';
            logger.debug(
                `DeepTrigger: Parent ${String(parent)} has dep on ${String(key)}? ${hasDep}`,
            );
            if (parentDeps?.[key]) {
                parentDeps[key].notify(); // Fires effects on parent (e.g., watcher re-run)
                logger.debug(
                    `DeepTrigger: Bubbled ${String(key)} on ${String(parent)}`,
                );
            }

            current = parent; // Climb
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
    return chain.reverse(); // Root-first for debug
}
