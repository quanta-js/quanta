import { Dependency } from './dependency';
import { logger } from '../services/logger-service';
import { StoreSubscriber } from '../type/store-types';
import { bubbleTrigger, parentMap } from '../utils/deep-trigger';

const targetMap = new WeakMap<object, Map<string | symbol, Dependency>>();
export { targetMap };
let activeEffect: StoreSubscriber | null = null;

/**
 * Temporarily pause dependency tracking.
 * Any reactive reads while tracking is paused will NOT register dependencies.
 * Must be paired with `resumeTracking()`.
 *
 * @returns The previously active effect, to pass to `resumeTracking()`.
 */
export function pauseTracking(): StoreSubscriber | null {
    const prev = activeEffect;
    activeEffect = null;
    return prev;
}

/**
 * Resume dependency tracking after a `pauseTracking()` call.
 *
 * @param prev - The return value from the matching `pauseTracking()` call.
 */
export function resumeTracking(prev: StoreSubscriber | null): void {
    activeEffect = prev;
}

/**
 * Per-effect set of Dependency objects the effect is subscribed to.
 * Used by reactiveEffect to clean up stale subscriptions before re-running.
 */
const effectDeps = new WeakMap<StoreSubscriber, Set<Dependency>>();

let isBatching = false;
const effectQueue = new Set<StoreSubscriber>();
const effectStack: StoreSubscriber[] = [];

// Start and process batched effects
export function batchEffects(fn: StoreSubscriber) {
    try {
        isBatching = true;
        fn();
        isBatching = false;

        // Trigger all queued effects
        const queueSize = effectQueue.size;
        if (queueSize > 0) {
            effectQueue.forEach((effect) => {
                try {
                    effect();
                } catch (error) {
                    logger.error(
                        `Effect: Failed to execute queued effect: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    );
                    throw error;
                }
            });
            effectQueue.clear();
        }
    } catch (error) {
        isBatching = false;
        effectQueue.clear();
        logger.error(
            `Effect: Batch processing failed: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        throw error;
    }
}

// Updated trigger function with batching support and enhanced error logging
export function trigger(target: object, prop: string | symbol) {
    try {
        const depsMap = targetMap.get(target);
        if (depsMap && depsMap.has(prop)) {
            const effects = depsMap.get(prop)!.getSubscribers;

            if (effects.size > 0) {
                effects.forEach((effect) => {
                    if (isBatching) {
                        effectQueue.add(effect);
                    } else {
                        if (effectStack.includes(effect)) {
                            const errorMessage = `Circular dependency detected: Effect "${effect.name || 'anonymous'}" triggered itself.`;
                            logger.error(`Effect: ${errorMessage}`);
                            throw new Error(errorMessage);
                        }

                        try {
                            effect();
                        } catch (error) {
                            logger.error(
                                `Effect: Failed to execute effect "${effect.name || 'anonymous'}": ${
                                    error instanceof Error
                                        ? error.message
                                        : String(error)
                                }`,
                            );
                            throw error;
                        }
                    }
                });
            }
        }
        // Only bubble if this target has a registered parent (skip for root-level state)
        if (parentMap.has(target)) {
            bubbleTrigger(target, prop, targetMap);
        }
    } catch (error) {
        logger.error(
            `Effect: Trigger failed for property "${String(prop)}": ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        throw error;
    }
}

// Track dependencies for reactive properties with enhanced error logging
export function track(target: object, prop: string | symbol) {
    try {
        let depsMap = targetMap.get(target);
        if (!depsMap) {
            depsMap = new Map();
            targetMap.set(target, depsMap);
        }

        if (!depsMap.has(prop)) {
            depsMap.set(prop, new Dependency());
        }

        if (activeEffect) {
            const dep = depsMap.get(prop)!;
            dep.depend(activeEffect);
            // Record this dep on the effect so it can be cleaned up later
            const deps = effectDeps.get(activeEffect);
            if (deps) {
                deps.add(dep);
            }
        }
    } catch (error) {
        logger.error(
            `Effect: Failed to track dependency for property "${String(prop)}": ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        throw error;
    }
}

// Reactive effect to handle reactivity with comprehensive error handling
export function reactiveEffect(effectFn: StoreSubscriber) {
    // Create a deps set for this effect to enable cleanup
    const deps = new Set<Dependency>();

    const wrappedEffect = () => {
        if (effectStack.includes(wrappedEffect)) {
            const errorMessage = `Circular dependency detected: Effect "${
                effectFn.name || 'anonymous'
            }" triggered itself. Stack trace: ${effectStack
                .map((e) => e.name || 'anonymous')
                .join(' -> ')}`;
            logger.error(`Effect: ${errorMessage}`);
            throw new Error(errorMessage);
        }

        try {
            // Cleanup: remove this effect from all its old dependencies
            // This prevents unbounded subscriber accumulation when deps change
            deps.forEach((dep) => dep.remove(wrappedEffect));
            deps.clear();

            // Run the effect, re-tracking fresh dependencies
            effectStack.push(wrappedEffect);
            activeEffect = wrappedEffect;
            effectFn();
        } catch (error) {
            logger.error(
                `Effect: Effect "${effectFn.name || 'anonymous'}" failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
            throw error;
        } finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1] || null;
        }
    };

    // Register the deps set for this effect so track() can populate it
    effectDeps.set(wrappedEffect, deps);

    wrappedEffect(); // Run the effect immediately
    return wrappedEffect;
}
