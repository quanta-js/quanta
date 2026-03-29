import { track, trigger, batchEffects } from './effect';
import { logger } from '../services/logger-service';
import { parentMap, setParent } from '../utils/deep-trigger';
import { devtools } from '../devtools';

// Symbol used to retrieve the raw target from a proxy
export const RAW_SYMBOL = Symbol('quanta_raw');

/**
 * Returns the raw target object if the value is a QuantaJS proxy.
 */
export function toRaw<T>(observed: T): T {
    const raw = observed && (observed as any)[RAW_SYMBOL];
    return raw ? toRaw(raw) : observed;
}

// Array methods that mutate — intercepted to batch triggers
const ARRAY_MUTATOR_SET = new Set([
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse',
    'fill',
    'copyWithin',
]);

// Cache Proxies per raw target (prevents double-wrapping base objects)
const reactiveMap = new WeakMap<object, object>();

// Track all created proxies so we don't wrap a proxy in another proxy
const proxySet = new WeakSet<object>();

// handles Map and Set types specifically
function createReactiveCollection(target: Map<any, any> | Set<any>) {
    if (reactiveMap.has(target)) {
        return reactiveMap.get(target);
    }
    if (proxySet.has(target)) {
        return target;
    }

    // Helper to deeply wrap returned items
    const wrap = (val: any) => {
        const reactiveVal = createReactive(val);
        if (typeof val === 'object' && val !== null) {
            setParent(val, target, 'size'); // Using size as a generic key for collections
        }
        return reactiveVal;
    };

    const instrumentations: Record<string | symbol, Function> = {
        get(key: any) {
            const rawKey = toRaw(key);
            const result = (target as Map<any, any>).get(rawKey);
            track(target, rawKey);
            return wrap(result);
        },
        has(key: any) {
            const rawKey = toRaw(key);
            track(target, rawKey);
            return target.has(rawKey);
        },
        add(key: any) {
            const rawKey = toRaw(key);
            const hadKey = target.has(rawKey);
            const result = (target as Set<any>).add(rawKey);
            if (!hadKey) {
                trigger(target, 'size');
                trigger(target, rawKey);
                if (devtools.enabled)
                    devtools.notifyStateChange(target, 'add', rawKey, parentMap);
            }
            return this;
        },
        set(key: any, value: any) {
            const rawKey = toRaw(key);
            const hadKey = (target as Map<any, any>).has(rawKey);
            const oldValue = (target as Map<any, any>).get(rawKey);
            const result = (target as Map<any, any>).set(rawKey, value);
            if (!hadKey) {
                trigger(target, 'size');
                trigger(target, rawKey);
                if (devtools.enabled)
                    devtools.notifyStateChange(target, rawKey, value, parentMap);
            } else if (!Object.is(oldValue, value)) {
                trigger(target, rawKey);
                trigger(target, 'size'); // Fix: notify iterator-based subscribers on value changes
                if (devtools.enabled)
                    devtools.notifyStateChange(target, rawKey, value, parentMap);
            }
            return this;
        },
        delete(key: any) {
            const rawKey = toRaw(key);
            const hadKey = (target as Map<any, any>).has(rawKey);
            const result = target.delete(rawKey);
            if (hadKey) {
                trigger(target, 'size');
                trigger(target, rawKey);
                if (devtools.enabled)
                    devtools.notifyStateChange(
                        target,
                        'delete',
                        rawKey,
                        parentMap,
                    );
            }
            return result;
        },
        clear() {
            const hadItems = target.size !== 0;
            const result = target.clear();
            if (hadItems) {
                trigger(target, 'size');
                if (devtools.enabled)
                    devtools.notifyStateChange(
                        target,
                        'clear',
                        undefined,
                        parentMap,
                    );
            }
            return result;
        },
        forEach(callback: Function, thisArg?: any) {
            track(target, 'size');
            return target.forEach((value: any, key: any) => {
                callback.call(
                    thisArg,
                    wrap(value),
                    target instanceof Map ? key : wrap(key),
                    this,
                );
            });
        },
    };

    // Iterator methods
    const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator];
    iteratorMethods.forEach((method) => {
        instrumentations[method as string] = function (...args: any[]) {
            track(target, 'size');
            const innerIterator = (target as any)[method](...args);
            const isEntries =
                method === 'entries' ||
                (method === Symbol.iterator && target instanceof Map);

            return {
                next() {
                    const { value, done } = innerIterator.next();
                    if (done) return { value, done };
                    return {
                        value: isEntries
                            ? [
                                  target instanceof Map
                                      ? value[0] // Don't wrap Map keys (preserve identity)
                                      : wrap(value[0]),
                                  wrap(value[1]),
                              ]
                            : method === 'keys' && target instanceof Map
                              ? value // Don't wrap Map keys
                              : wrap(value),
                        done,
                    };
                },
                [Symbol.iterator]() {
                    return this;
                },
            };
        };
    });

    const proxy = new Proxy(target, {
        get(_, prop: string | symbol, receiver) {
            if (prop === RAW_SYMBOL) {
                return target;
            }
            try {
                if (prop === 'size') {
                    track(target, 'size');
                    return target.size;
                }
                if (Reflect.has(instrumentations, prop)) {
                    return typeof instrumentations[prop] === 'function'
                        ? instrumentations[prop].bind(receiver)
                        : instrumentations[prop];
                }
                track(target, prop);
                return Reflect.get(target, prop, receiver);
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

    reactiveMap.set(target, proxy);
    proxySet.add(proxy);
    return proxy;
}

/**
 * Checks if an object is a QuantaJS reactive proxy.
 */
export function isReactive(target: any): boolean {
    return proxySet.has(target);
}

// createReactive function to handle all data types
export function createReactive(target: any) {
    try {
        // Guard: skip non-proxyable values (primitives, null, Date, RegExp, etc.)
        if (target === null || target === undefined) {
            return target;
        }
        if (typeof target !== 'object' && typeof target !== 'function') {
            return target;
        }
        // Skip built-in types that don't benefit from Proxy wrapping
        if (
            target instanceof Date ||
            target instanceof RegExp ||
            target instanceof Error ||
            target instanceof Promise ||
            target instanceof WeakMap ||
            target instanceof WeakSet ||
            target instanceof ArrayBuffer ||
            (typeof SharedArrayBuffer !== 'undefined' &&
                target instanceof SharedArrayBuffer) ||
            ArrayBuffer.isView(target)
        ) {
            return target;
        }

        // Global cache check (prevents double-wrapping the raw target)
        if (reactiveMap.has(target)) {
            return reactiveMap.get(target);
        }

        // Prevent wrapping an existing proxy in another proxy!
        // This stops exponential trap chaining when spreading reactive arrays `[...proxies]`
        if (proxySet.has(target)) {
            return target;
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
                if (prop === RAW_SYMBOL) {
                    return obj;
                }
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

                    // Intercept mutating array methods to batch triggers
                    if (
                        Array.isArray(obj) &&
                        typeof prop === 'string' &&
                        typeof result === 'function' &&
                        ARRAY_MUTATOR_SET.has(prop)
                    ) {
                        return (...args: any[]) => {
                            let methodResult: any;
                            batchEffects(() => {
                                // Apply to receiver (the proxy) so index sets trap natively
                                methodResult = result.apply(receiver, args);
                            });
                            // Explicitly trigger length because engine updates it before the length-trap hits
                            trigger(obj, 'length');
                            return methodResult;
                        };
                    }

                    track(obj, prop);

                    // Handle nested reactivity for objects or arrays
                    if (typeof result === 'object' && result !== null) {
                        // Cache-aware recursion + set parent on returned Proxy
                        const nested = createReactive(result);
                        if (
                            typeof prop === 'string' ||
                            typeof prop === 'symbol'
                        ) {
                            setParent(result, obj, prop);
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

                    // Trigger updates if value actually changed (Object.is handles NaN, -0 correctly)
                    if (!Object.is(oldValue, value)) {
                        trigger(obj, prop);
                        // Set parent mapping for new nested objects
                        if (typeof value === 'object' && value !== null) {
                            createReactive(value); // Cache-safe wrap
                        }

                        if (devtools.enabled)
                            devtools.notifyStateChange(
                                obj,
                                prop,
                                value,
                                parentMap,
                            );
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
                        trigger(obj, 'keys'); // Notify ownKeys watchers (e.g., Object.keys())
                        if (devtools.enabled) {
                            devtools.notifyStateChange(
                                obj,
                                prop,
                                undefined,
                                parentMap,
                            );
                        }
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
                    // Phase 7.2: Stop tracking descriptors to reduce noise
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
        proxySet.add(proxy);
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
