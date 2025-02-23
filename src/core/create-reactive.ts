import { track, trigger } from './effect';

// This method handles Map and Set types specifically
function createReactiveCollection(target: Map<any, any> | Set<any>) {
    return new Proxy(target, {
        get(target, prop: string | symbol) {
            if (prop === 'size') {
                track(target, 'size'); // Track 'size' dependency for collections
                return target.size; // Directly return the size value
            }

            // Handle methods like `get`, `set`, `add`, `delete`, etc.
            if (prop === 'get') {
                const method = Reflect.get(target, prop);
                return (key: any) => {
                    const value = method.call(target, key);
                    track(target, key); // Track dependency for the specific key
                    return value;
                };
            }

            if (prop === 'set' || prop === 'add' || prop === 'delete') {
                const method = Reflect.get(target, prop);
                return (...args: any[]) => {
                    const result = method.apply(target, args);
                    trigger(target, 'size'); // Trigger size change notifications
                    if (prop === 'set') {
                        const [key] = args;
                        trigger(target, key); // Trigger reactivity for the modified key-value pair
                    }
                    return result;
                };
            }

            // Handle `clear` method which does not take arguments
            if (prop === 'clear') {
                const method = Reflect.get(target, prop);
                return () => {
                    const result = method.apply(target); // No args passed to `clear`
                    trigger(target, 'size'); // Trigger size change when cleared
                    return result;
                };
            }

            // For all other properties, track dependencies
            track(target, prop);
            return Reflect.get(target, prop);
        },
    });
}

// Main createReactive function to handle all data types
export function createReactive(target: any) {
    if (target instanceof Map || target instanceof Set) {
        return createReactiveCollection(target); // Handle Map/Set specially
    }

    return new Proxy(target, {
        get(obj: { [key: string]: any }, prop: string | symbol, receiver: any) {
            const result = Reflect.get(obj, prop, receiver);

            // Track dependencies for `size` property on collections
            if (prop === 'size' && (obj instanceof Map || obj instanceof Set)) {
                track(obj, 'size'); // Special case for Map/Set size
                return result; // Return size immediately
            }

            track(obj, prop); // Track dependencies for regular properties

            // Handle nested reactivity for objects or arrays
            if (typeof result === 'object' && result !== null) {
                return createReactive(result); // Create nested reactive objects
            }

            return result;
        },
        set(
            obj: { [key: string]: any },
            prop: string,
            value: any,
            receiver: any,
        ) {
            const oldValue = obj[prop];
            const result = Reflect.set(obj, prop, value, receiver);

            // Trigger updates if value changes
            if (oldValue !== value || (isNaN(oldValue) && isNaN(value))) {
                trigger(obj, prop); // Notify dependencies of change
            }

            return result;
        },
        deleteProperty(obj: { [key: string]: any }, prop: string | symbol) {
            const hadKey = prop in obj;
            const result = Reflect.deleteProperty(obj, prop);

            // Trigger updates if the property was deleted
            if (hadKey) {
                trigger(obj, prop);
            }

            return result;
        },
        has(obj: { [key: string]: any }, prop: string | symbol) {
            track(obj, prop); // Track `in` operator
            return Reflect.has(obj, prop);
        },
        ownKeys(obj: { [key: string]: any }) {
            track(obj, 'keys'); // Track `Object.keys()` or similar
            return Reflect.ownKeys(obj);
        },
        getOwnPropertyDescriptor(
            obj: { [key: string]: any },
            prop: string | symbol,
        ) {
            track(obj, prop); // Track descriptor access
            return Reflect.getOwnPropertyDescriptor(obj, prop);
        },
    });
}
