import { reactiveEffect, pauseTracking, resumeTracking } from '../core/effect';
import { toRaw } from '../core/create-reactive';

export interface WatchOptions {
    /**
     * Recursively touch every nested property of the source value so that any
     * change beneath it fires the callback.
     *
     * Costs a full traversal of the value on each run — use a narrower source
     * expression where you can.
     */
    deep?: boolean;
    /** Invoke the callback once immediately, before the first change. */
    immediate?: boolean;
}

/** Call to stop a watcher. Idempotent. */
export type WatchStopHandle = () => void;

/** Distinguishes "never run" from a legitimate `undefined` first value. */
const UNSET = Symbol('quanta.unset');

/**
 * Recursively read every nested property so each becomes a dependency.
 *
 * Iterating through the *reactive proxy* is what registers the dependencies,
 * so this deliberately does not use `toRaw`. The `visited` set guards against
 * cyclic structures.
 */
function deepAccess(value: unknown, visited: WeakSet<object>): void {
    if (value === null || typeof value !== 'object') return;

    // Cycle guard keyed on raw identity: the same object reached via two
    // different proxies must count as already-visited.
    const raw = toRaw(value) as object;
    if (visited.has(raw)) return;
    visited.add(raw);

    if (value instanceof Map) {
        value.forEach((entryValue, entryKey) => {
            deepAccess(entryKey, visited);
            deepAccess(entryValue, visited);
        });
        return;
    }
    if (value instanceof Set) {
        value.forEach((entry) => deepAccess(entry, visited));
        return;
    }
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) deepAccess(value[i], visited);
        return;
    }
    for (const key of Object.keys(value)) {
        deepAccess((value as Record<string, unknown>)[key], visited);
    }
}

/**
 * Run `callback` whenever the value produced by `source` changes.
 *
 * The source function is tracked: it re-runs when any reactive value it read
 * changes, and the callback fires only if the produced value actually differs
 * (by `Object.is`), or on every tracked change when `deep` is set.
 *
 * @param source   - Reads the value to observe.
 * @param callback - Receives `(newValue, oldValue)`.
 * @param options  - See {@link WatchOptions}.
 * @returns A function that stops the watcher.
 *
 * @example
 * ```ts
 * const stop = watch(
 *     () => state.user.id,
 *     (id, previousId) => refetch(id, previousId),
 * );
 * stop();
 * ```
 */
const watch = <T>(
    source: () => T,
    callback: (value: T, oldValue: T | undefined) => void,
    options: WatchOptions = {},
): WatchStopHandle => {
    const { deep = false, immediate = false } = options;
    let oldValue: T | typeof UNSET = UNSET;

    const runner = reactiveEffect(() => {
        const value = source();

        if (deep) deepAccess(value, new WeakSet());

        // Pause tracking around the callback. Without this, reactive reads
        // inside the callback are attributed to this watcher, so the watcher
        // ends up depending on state it merely *reacted to* — producing
        // cascading re-triggers and, in a chain of watchers, exponential
        // slowdown.
        const previous = pauseTracking();
        try {
            if (oldValue === UNSET) {
                oldValue = value;
                if (immediate) callback(value, undefined);
                return;
            }

            // In deep mode the effect only re-runs because a tracked nested
            // dependency genuinely changed. Comparing is pointless — the proxy
            // identity is unchanged, so Object.is would always say "equal" and
            // the callback would never fire.
            if (deep || !Object.is(value, oldValue)) {
                const previousValue = oldValue as T;
                oldValue = value;
                callback(value, previousValue);
            }
        } finally {
            resumeTracking(previous);
        }
    });

    return () => runner.stop();
};

export default watch;
