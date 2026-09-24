/**
 * Shallow structural equality for objects and arrays, one level deep.
 *
 * The companion to a selector or watch source that builds a new object on
 * each run, which `Object.is` never matches:
 * ```ts
 * watch(
 *     () => ({ name: user.name, email: user.email }),
 *     save,
 *     { equals: shallow },
 * );
 * ```
 */
export function shallow<T>(a: T, b: T): boolean {
    if (Object.is(a, b)) return true;
    if (
        typeof a !== 'object' ||
        a === null ||
        typeof b !== 'object' ||
        b === null
    ) {
        return false;
    }

    if (Array.isArray(a) !== Array.isArray(b)) return false;

    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
        if (
            !Object.prototype.hasOwnProperty.call(b, key) ||
            !Object.is(
                (a as Record<string, unknown>)[key],
                (b as Record<string, unknown>)[key],
            )
        ) {
            return false;
        }
    }
    return true;
}
