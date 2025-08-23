import { track, trigger } from './effect';
import { logger } from '../services/logger-service';

// handles Map and Set types specifically
function createReactiveCollection(target: Map<any, any> | Set<any>) {
    return new Proxy(target, {
        get(target, prop: string | symbol) {
            try {
                if (prop === 'size') {
                    track(target, 'size'); // Track 'size' dependency for collections
                    return target.size; // Directly return the size value
                }

                // Handle methods like `get`, `set`, `add`, `delete`, etc.
                if (prop === 'get') {
                    const method = Reflect.get(target, prop);
                    return (key: any) => {
                        try {
                            const value = method.call(target, key);
                            track(target, key); // Track dependency for the specific key
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
                            trigger(target, 'size'); // Trigger size change notifications

                            if (prop === 'set') {
                                const [key] = args;
                                trigger(target, key); // Trigger reactivity for the modified key-value pair
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

                // Handle `clear` method which does not take arguments
                if (prop === 'clear') {
                    const method = Reflect.get(target, prop);
                    return () => {
                        try {
                            const result = method.apply(target); // No args passed to `clear`
                            trigger(target, 'size'); // Trigger size change when cleared
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

                // For all other properties, track dependencies
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
}

// createReactive function to handle all data types
export function createReactive(target: any) {
    try {
        if (target instanceof Map || target instanceof Set) {
            return createReactiveCollection(target); // Handle Map/Set specially
        }

        return new Proxy(target, {
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
                        track(obj, 'size'); // Special case for Map/Set size
                        return result; // Return size immediately
                    }

                    track(obj, prop); // Track dependencies for regular properties

                    // Handle nested reactivity for objects or arrays
                    if (typeof result === 'object' && result !== null) {
                        return createReactive(result); // Create nested reactive objects
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
                        trigger(obj, prop); // Notify dependencies of change
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
                    track(obj, prop); // Track `in` operator
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
                    track(obj, 'keys'); // Track `Object.keys()` or similar
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
                    track(obj, prop); // Track descriptor access
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
    } catch (error) {
        logger.error(
            `Reactive: Failed to create reactive object: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        throw error;
    }
}
