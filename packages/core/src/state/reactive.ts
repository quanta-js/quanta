import { createReactive, isReactive } from '../core/create-reactive';

/**
 * Creates a reactive proxy around an object, array, Map, or Set.
 *
 * @param target - The object to make reactive
 * @returns A reactive proxy
 */
export function reactive<T extends object>(target: T): T {
    return createReactive(target);
}

/**
 * Checks if a value is a QuantaJS reactive proxy.
 *
 * @param value - The value to check
 * @returns True if the value is reactive
 */
export { isReactive };
