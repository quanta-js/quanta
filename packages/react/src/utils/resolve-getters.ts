/**
 *  Helper: unwrap computed getter objects to raw values or functions
 */
export const resolveGetterValue = (getter: any, storeRef: any) => {
    try {
        if (getter && typeof getter === 'object' && 'value' in getter) {
            // computed(...) -> { get value() } — return the value
            return getter.value;
        }
        if (typeof getter === 'function') {
            // A raw function getter (rare) — bind to the store
            return getter.bind(storeRef);
        }
        // Fallback (primitive)
        return getter;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        // fall back safely
        return getter;
    }
};
