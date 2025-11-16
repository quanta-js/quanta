import { targetMap, track, trigger } from './effect';
import { logger } from '../services/logger-service';
import { bubbleTrigger, parentMap } from '../utils/deep-trigger';

// Cache Proxies per raw target (prevents double-wrapping)
const reactiveMap = new WeakMap<object, object>();

// handles Map and Set types specifically
function createReactiveCollection(target: Map<any, any> | Set<any>) {
    // Cache for collections too
    if (reactiveMap.has(target)) {
        return reactiveMap.get(target);
    }
    const proxy = new Proxy(target, {
        get(target, prop: string | symbol) {
            try {
                if (prop === 'size') {
                    track(target, 'size');
                    return target.size;
                }
                if (prop === 'get') {
                    const method = Reflect.get(target, prop);
                    return (key: any) => {
                        try {
                            const value = method.call(target, key);
                            track(target, key);
                            return value;
                        } catch (error) {
                            logger.error(
                                `Reactive: Failed to get collection value for key "${String(key)}": ${
                                    error instanceof Error
                                        ? error.message
                                        : String(error)
                                }`,
                            );
                            throw error;
                        }
                    };
                }
                if (prop === 'set' || prop === 'add' || prop === 'delete') {
                    const method = Reflect.get(target, prop);
                    return (...args: any[]) => {
                        try {
                            const result = method.apply(target, args);
                            trigger(target, 'size');
                            if (prop === 'set') {
                                const [key] = args;
                                trigger(target, key);
                            }
                            return result;
                        } catch (error) {
                            logger.error(
                                `Reactive: Failed to execute collection operation "${String(prop)}": ${
                                    error instanceof Error
                                        ? error.message
                                        : String(error)
                                }`,
                            );
                            throw error;
                        }
                    };
                }
                if (prop === 'clear') {
                    const method = Reflect.get(target, prop);
                    return () => {
                        try {
                            const result = method.apply(target);
                            trigger(target, 'size');
                            return result;
                        } catch (error) {
                            logger.error(
                                `Reactive: Failed to clear collection: ${
                                    error instanceof Error
                                        ? error.message
                                        : String(error)
                                }`,
                            );
                            throw error;
                        }
                    };
                }
                track(target, prop);
                return Reflect.get(target, prop);
            } catch (error) {
                logger.error(
                    `Reactive: Failed to access collection property "${String(prop)}": ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
                throw error;
            }
        },
    });
    reactiveMap.set(target, proxy); // Cache the Proxy
    return proxy;
}

// createReactive function to handle all data types
export function createReactive(target: any) {
    try {
        // Global cache check (prevents any double-wrapping)
        if (reactiveMap.has(target)) {
            return reactiveMap.get(target);
        }

        if (target instanceof Map || target instanceof Set) {
            return createReactiveCollection(target);
        }

        const proxy = new Proxy(target, {
            get(
                obj: { [key: string]: any },
                prop: string | symbol,
                receiver: any,
            ) {
                try {
                    const result = Reflect.get(obj, prop, receiver);

                    // Track dependencies for `size` property on collections
                    if (
                        prop === 'size' &&
                        (obj instanceof Map || obj instanceof Set)
                    ) {
                        track(obj, 'size');
                        return result;
                    }

                    track(obj, prop);

                    // Handle nested reactivity for objects or arrays
                    if (typeof result === 'object' && result !== null) {
                        // Cache-aware recursion + set parent on returned Proxy
                        const nested = createReactive(result); // Returns existing/cached Proxy if wrapped
                        if (
                            typeof prop === 'string' ||
                            typeof prop === 'symbol'
                        ) {
                            parentMap.set(result, { parent: obj, key: prop });
                            logger.debug(
                                `Reactive: Set parent for raw ${String(prop)} (${String(result)}) on ${String(obj)}`,
                            );
                        }
                        return nested;
                    }

                    return result;
                } catch (error) {
                    logger.error(
                        `Reactive: Failed to get property "${String(prop)}": ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    );
                    throw error;
                }
            },
            set(
                obj: { [key: string]: any },
                prop: string,
                value: any,
                receiver: any,
            ) {
                try {
                    const oldValue = obj[prop];
                    const result = Reflect.set(obj, prop, value, receiver);

                    // Trigger updates if value changes
                    if (
                        oldValue !== value ||
                        (isNaN(oldValue) && isNaN(value))
                    ) {
                        trigger(obj, prop);
                        // Bubble only if setting a new object (for child mutations, trigger handles)
                        if (typeof value === 'object' && value !== null) {
                            // Wrap new value if needed, then bubble from it
                            const wrappedValue = createReactive(value); // Cache-safe
                            bubbleTrigger(wrappedValue, prop, targetMap);
                        }
                    }

                    return result;
                } catch (error) {
                    logger.error(
                        `Reactive: Failed to set property "${String(prop)}": ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    );
                    throw error;
                }
            },
            deleteProperty(obj: { [key: string]: any }, prop: string | symbol) {
                try {
                    const hadKey = prop in obj;
                    const result = Reflect.deleteProperty(obj, prop);

                    // Trigger updates if the property was deleted
                    if (hadKey) {
                        trigger(obj, prop);
                    }

                    return result;
                } catch (error) {
                    logger.error(
                        `Reactive: Failed to delete property "${String(prop)}": ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    );
                    throw error;
                }
            },
            has(obj: { [key: string]: any }, prop: string | symbol) {
                try {
                    track(obj, prop);
                    return Reflect.has(obj, prop);
                } catch (error) {
                    logger.error(
                        `Reactive: Failed to check property "${String(prop)}" existence: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    );
                    throw error;
                }
            },
            ownKeys(obj: { [key: string]: any }) {
                try {
                    track(obj, 'keys');
                    return Reflect.ownKeys(obj);
                } catch (error) {
                    logger.error(
                        `Reactive: Failed to get own keys: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    );
                    throw error;
                }
            },
            getOwnPropertyDescriptor(
                obj: { [key: string]: any },
                prop: string | symbol,
            ) {
                try {
                    track(obj, prop);
                    return Reflect.getOwnPropertyDescriptor(obj, prop);
                } catch (error) {
                    logger.error(
                        `Reactive: Failed to get property descriptor for "${String(prop)}": ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    );
                    throw error;
                }
            },
        });

        // Cache the top-level Proxy too
        reactiveMap.set(target, proxy);
        return proxy;
    } catch (error) {
        logger.error(
            `Reactive: Failed to create reactive object: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        throw error;
    }
}
