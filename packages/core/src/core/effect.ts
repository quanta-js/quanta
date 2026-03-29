import { Dependency } from './dependency';
import { logger } from '../services/logger-service';
import type { EffectFunction } from '../type/store-types';
import { bubbleTrigger, parentMap } from '../utils/deep-trigger';

export interface EffectOptions {
    /** Custom scheduler for when the effect's dependencies change */
    scheduler?: (effect: EffectRunner) => void;
    /** If true, the effect will not run immediately upon creation */
    lazy?: boolean;
}

/**
 * A disposable effect function with a stop() method for cleanup.
 * Calling the function re-runs the effect; calling stop() permanently
 * unsubscribes and prevents further execution.
 */
export interface EffectRunner extends EffectFunction {
    /** Whether this effect is currently active (not stopped). */
    active: boolean;
    /** Permanently stop this effect and remove it from all dependency sets. */
    stop: () => void;
    /** Custom scheduler (if provided) */
    scheduler?: (effect: EffectRunner) => void;
}

const targetMap = new WeakMap<object, Map<string | symbol, Dependency>>();
export { targetMap };
let activeEffect: EffectFunction | null = null;

/**
 * Temporarily pause dependency tracking.
 * Any reactive reads while tracking is paused will NOT register dependencies.
 * Must be paired with `resumeTracking()`.
 *
 * @returns The previously active effect, to pass to `resumeTracking()`.
 */
export function pauseTracking(): EffectFunction | null {
    const prev = activeEffect;
    activeEffect = null;
    return prev;
}

/**
 * Resume dependency tracking after a `pauseTracking()` call.
 *
 * @param prev - The return value from the matching `pauseTracking()` call.
 */
export function resumeTracking(prev: EffectFunction | null): void {
    activeEffect = prev;
}

/**
 * Per-effect set of Dependency objects the effect is subscribed to.
 * Used by reactiveEffect to clean up stale subscriptions before re-running.
 */
const effectDeps = new WeakMap<EffectFunction, Set<Dependency>>();

let batchDepth = 0;
const effectQueue = new Set<EffectFunction>();
const effectStack: EffectFunction[] = [];

/**
 * Batch multiple state mutations so dependent effects only run once.
 * Supports nesting — effects are flushed only when the outermost batch completes.
 *
 * @example
 * ```ts
 * batchEffects(() => {
 *     state.a = 1;
 *     state.b = 2; // Effects that depend on both a & b run once, not twice
 * });
 * ```
 */
export function batchEffects(fn: EffectFunction) {
    batchDepth++;
    let success = false;
    try {
        fn();
        success = true;
    } finally {
        batchDepth--;
        if (batchDepth === 0) {
            if (success) {
                // Flush all queued effects from this (and any nested) batch
                const queue = [...effectQueue];
                effectQueue.clear();
                for (const effect of queue) {
                    const runner = effect as EffectRunner;
                    if (runner.active === false) continue;

                    try {
                        if (runner.scheduler) {
                            runner.scheduler(runner);
                        } else {
                            effect();
                        }
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
                }
            } else {
                // Batch failed/aborted, discard the queued triggers
                effectQueue.clear();
            }
        }
    }
}

// Updated trigger function with batching support and enhanced error logging
export function trigger(target: object, prop: string | symbol) {
    try {
        const depsMap = targetMap.get(target);
        if (depsMap && depsMap.has(prop)) {
            const effects = depsMap.get(prop)!.getSubscribers;
            // Snapshot subscribers into an array BEFORE iterating.
            // Effects may remove/re-add themselves to the Set during execution;
            // iterating the live Set would cause an infinite loop per ES spec.
            const effectSnapshot = [...effects];

            if (effectSnapshot.length > 0) {
                for (const effect of effectSnapshot) {
                    const runner = effect as EffectRunner;
                    if (runner.active === false) continue;

                    if (batchDepth > 0) {
                        effectQueue.add(effect);
                    } else {
                        if (effectStack.includes(effect)) {
                            const errorMessage = `Circular dependency detected: Effect "${effect.name || 'anonymous'}" triggered itself.`;
                            logger.error(`Effect: ${errorMessage}`);
                            throw new Error(errorMessage);
                        }

                        try {
                            if ((effect as EffectRunner).scheduler) {
                                (effect as EffectRunner).scheduler!(
                                    effect as EffectRunner,
                                );
                            } else {
                                effect();
                            }
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
                }
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

/**
 * Create a reactive effect that automatically tracks dependencies and
 * re-runs when those dependencies change.
 *
 * Returns an `EffectRunner` — a callable function with a `.stop()` method.
 * Call `.stop()` to permanently unsubscribe and prevent further execution.
 *
 * @example
 * ```ts
 * const effect = reactiveEffect(() => {
 *     console.log(state.count); // tracks state.count
 * });
 * state.count++; // effect re-runs
 * effect.stop(); // permanently stopped
 * state.count++; // effect does NOT re-run
 * ```
 */
export function reactiveEffect(
    effectFn: EffectFunction,
    options?: EffectOptions,
): EffectRunner {
    // Create a deps set for this effect to enable cleanup
    const deps = new Set<Dependency>();
    let active = true;

    const wrappedEffect = (() => {
        // Guard: do not execute if this effect has been stopped
        if (!wrappedEffect.active) return;

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
    }) as EffectRunner;

    wrappedEffect.active = true;

    /**
     * Permanently stop this effect:
     * - Remove from all dependency subscriber sets
     * - Prevent future execution via the active guard
     * - Clean up the effectDeps entry
     */
    wrappedEffect.stop = () => {
        if (!wrappedEffect.active) return; // Idempotent
        wrappedEffect.active = false;
        deps.forEach((dep) => dep.remove(wrappedEffect));
        deps.clear();
        effectDeps.delete(wrappedEffect);
    };

    if (options && options.scheduler) {
        wrappedEffect.scheduler = options.scheduler;
    }

    // Register the deps set for this effect so track() can populate it
    effectDeps.set(wrappedEffect, deps);

    if (!options || !options.lazy) {
        wrappedEffect(); // Run the effect immediately
    }
    return wrappedEffect;
}
