import {
    createReactive,
    shallowReactive as createShallow,
    readonly as createReadonly,
    shallowReadonly as createShallowReadonly,
} from '../core/create-reactive';

/**
 * Wrap an object, array, `Map` or `Set` in a deeply reactive proxy.
 *
 * Reads inside an effect register a dependency; writes notify the dependents
 * of exactly the properties that changed. Nested objects are wrapped lazily on
 * first access, so the cost is proportional to what you actually touch.
 *
 * Primitives, `null`, non-proxyable built-ins (`Date`, `RegExp`, `Promise`,
 * typed arrays…) and `markRaw`-ed objects are returned unchanged.
 *
 * @example
 * ```ts
 * const state = reactive({ user: { name: 'Ada' }, tags: ['x'] });
 * effect(() => console.log(state.user.name)); // logs 'Ada'
 * state.user.name = 'Grace';                  // logs 'Grace'
 * ```
 */
export function reactive<T extends object>(target: T): T {
    return createReactive(target);
}

export {
    createShallow as shallowReactive,
    createReadonly as readonly,
    createShallowReadonly as shallowReadonly,
};

export {
    isReactive,
    isReadonly,
    isProxy,
    toRaw,
    markRaw,
} from '../core/create-reactive';
