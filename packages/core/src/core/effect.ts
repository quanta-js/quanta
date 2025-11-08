import { Dependency } from './dependency';
import { logger } from '../services/logger-service';
import { StoreSubscriber } from '../type/store-types';

const targetMap = new WeakMap<object, Record<string | symbol, Dependency>>();
let activeEffect: StoreSubscriber | null = null;

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
        if (depsMap && depsMap[prop]) {
            const effects = depsMap[prop].getSubscribers;
            const effectCount = effects.size;

            if (effectCount > 0) {
                effects.forEach((effect) => {
                    if (isBatching) {
                        effectQueue.add(effect); // Queue effects
                    } else {
                        if (effectStack.includes(effect)) {
                            const errorMessage = `Circular dependency detected: Effect "${
                                effect.name || 'anonymous'
                            }" triggered itself. Stack trace: ${effectStack
                                .map((e) => e.name || 'anonymous')
                                .join(' -> ')}`;
                            logger.error(`Effect: ${errorMessage}`);

                            // Provide detailed circular dependency information
                            const circularPath = [...effectStack, effect].map(
                                (e) => e.name || 'anonymous',
                            );
                            logger.error(
                                `Effect: Circular dependency path: ${circularPath.join(
                                    ' -> ',
                                )}`,
                            );

                            throw new Error(errorMessage);
                        }

                        try {
                            effect(); // Run immediately if not batching
                        } catch (error) {
                            logger.error(
                                `Effect: Failed to execute effect "${
                                    effect.name || 'anonymous'
                                }": ${
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
            targetMap.set(target, (depsMap = {}));
        }

        if (!depsMap[prop]) {
            depsMap[prop] = new Dependency();
        }

        if (activeEffect) {
            depsMap[prop].depend(activeEffect);
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
export function reactiveEffect(effect: StoreSubscriber) {
    const wrappedEffect = () => {
        if (effectStack.includes(effect)) {
            const errorMessage = `Circular dependency detected: Effect "${
                effect.name || 'anonymous'
            }" triggered itself. Stack trace: ${effectStack
                .map((e) => e.name || 'anonymous')
                .join(' -> ')}`;
            logger.error(`Effect: ${errorMessage}`);

            // Provide detailed circular dependency information
            const circularPath = [...effectStack, effect].map(
                (e) => e.name || 'anonymous',
            );
            logger.error(
                `Effect: Circular dependency path: ${circularPath.join(' -> ')}`,
            );
            logger.error(
                `Effect: Current effect stack depth: ${effectStack.length}`,
            );

            throw new Error(errorMessage);
        }

        try {
            effectStack.push(effect);
            activeEffect = effect;
            effect();
        } catch (error) {
            logger.error(
                `Effect: Effect "${effect.name || 'anonymous'}" failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
            logger.error(
                `Effect: Effect stack at failure: ${effectStack
                    .map((e) => e.name || 'anonymous')
                    .join(' -> ')}`,
            );
            throw error;
        } finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1] || null;
        }
    };

    wrappedEffect(); // Run the effect immediately
    return wrappedEffect;
}
