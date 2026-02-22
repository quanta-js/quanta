import { reactiveEffect } from '../core/effect';
import { logger } from '../services/logger-service';

/**
 * Options for configuring a watcher.
 *
 * @property {boolean} [deep]
 * Whether to perform deep watching (i.e., recursively track nested object changes).
 * When `true`, the watcher recursively accesses all nested properties to register
 * reactive dependencies, so any nested change triggers the callback.
 *
 * @property {boolean} [immediate]
 * Whether to invoke the watcher callback immediately upon setup,
 * rather than waiting for the first change.
 */
interface WatchOptions {
    deep?: boolean;
    immediate?: boolean;
}

/** Sentinel value to distinguish "not yet initialized" from legitimate `undefined` */
const UNSET = Symbol('unset');

/**
 * Recursively access all properties of an object to register deep reactive dependencies.
 * This replaces the old setInterval/JSON.stringify polling approach.
 */
function deepAccess(obj: any, visited: WeakSet<object> = new WeakSet()): void {
    if (obj === null || typeof obj !== 'object') return;
    if (visited.has(obj)) return; // Prevent circular reference loops
    visited.add(obj);

    if (obj instanceof Map) {
        obj.forEach((value, key) => {
            deepAccess(key, visited);
            deepAccess(value, visited);
        });
    } else if (obj instanceof Set) {
        obj.forEach((value) => deepAccess(value, visited));
    } else if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            deepAccess(obj[i], visited);
        }
    } else {
        for (const key of Object.keys(obj)) {
            deepAccess(obj[key], visited);
        }
    }
}

const watch = <T>(
    source: () => T,
    callback: (value: T, oldValue?: T) => void,
    options: WatchOptions = {},
) => {
    const { deep = false, immediate = true } = options;
    let oldValue: T | typeof UNSET = UNSET;

    try {
        const effect = reactiveEffect(() => {
            try {
                const value = source();

                // Deep mode: recursively access all nested properties for tracking
                if (deep) {
                    deepAccess(value);
                }

                if (oldValue === UNSET) {
                    // First run
                    oldValue = value;
                    if (immediate) {
                        callback(value, undefined);
                    }
                } else if (!Object.is(value, oldValue)) {
                    const prev = oldValue;
                    oldValue = value;
                    callback(value, prev);
                }
            } catch (error) {
                logger.error(
                    `Watch: Failed to execute watch source function: ${error instanceof Error ? error.message : String(error)}`,
                );
                throw error;
            }
        });
        return effect;
    } catch (error) {
        logger.error(
            `Watch: Failed to create watcher: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
};

export default watch;
