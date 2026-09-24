'use client';

import {
    useCallback,
    useDebugValue,
    useEffect,
    useLayoutEffect,
    useRef,
    useSyncExternalStore,
} from 'react';
import {
    effect,
    untrack,
    type ActionsTree,
    type EffectRunner,
    type GettersTree,
    type StateTree,
    type Store,
} from '@quantajs/core';

/** useLayoutEffect in the browser, without the server-render warning. */
const useIsomorphicLayoutEffect =
    typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Compares the previous and next selector results to decide whether to
 * re-render. Return `true` to skip the render.
 */
export type EqualityFn<T> = (a: T, b: T) => boolean;

export interface SelectorOptions<T> {
    /**
     * Custom equality check. Defaults to {@link defaultEquality}: `Object.is`
     * for primitives, always-unequal for objects.
     *
     * Reach for {@link shallow} when the selector builds a new object or array
     * on every call — `Object.is` can never match those, so every store change
     * would re-render.
     */
    equalityFn?: EqualityFn<T>;
}

/**
 * The default equality used when no `equalityFn` is supplied.
 *
 * The comparison only ever runs because a tracked dependency changed, so the
 * question is not "did anything change?" but "is the *selection* still the same
 * value?".
 *
 * - **Primitives** compare with `Object.is`. A selector like `s => s.items.length`
 *   that still yields `3` should not re-render.
 * - **Objects always compare unequal.** A selector returning a live reactive
 *   object (`s => s.todos`) hands back the same identity before and after an
 *   in-place mutation, so `Object.is` would report "unchanged" and the
 *   component would render stale data — the exact defect this replaces. A
 *   selector returning a freshly-built object is genuinely new anyway.
 *
 * Pass {@link shallow} to opt into structural comparison for projections.
 */
function defaultEquality<T>(a: T, b: T): boolean {
    if (typeof a === 'object' && a !== null) return false;
    if (typeof b === 'object' && b !== null) return false;
    return Object.is(a, b);
}

/**
 * Subscribe to exactly the state a selector reads.
 *
 * ## Why this is effect-based rather than comparison-based
 *
 * The obvious implementation — re-run the selector on every store change and
 * compare the result with `Object.is` — is broken in both directions when the
 * state is a mutable proxy:
 *
 * - `s => s.todos` returns the *same proxy identity* before and after
 *   `todos.push(...)`, so the comparison reports "unchanged" and the component
 *   silently renders stale data.
 * - `s => s.todos.filter(...)` returns a fresh array every time, so the
 *   comparison always reports "changed" and the component re-renders on every
 *   unrelated mutation.
 *
 * Instead the selector runs inside a reactive effect. The reactivity system
 * records precisely which properties it touched, and the component is woken
 * only when one of *those* changes. Identity is then irrelevant to correctness
 * — `equalityFn` becomes a pure optimisation for the projection case rather
 * than the mechanism that makes updates work at all.
 *
 * This also makes subscriptions fine-grained: a component reading `s.a` is not
 * re-rendered when `s.b` changes.
 *
 * @param store    - The store to read from.
 * @param selector - Reads the slice this component needs.
 * @param options  - See {@link SelectorOptions}.
 * @returns The selected value.
 *
 * @example
 * ```tsx
 * const count = useQuantaSelector(cart, (s) => s.items.length);
 * ```
 */
export function useQuantaSelector<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
    T,
>(
    store: Store<S, G, A>,
    selector: (store: Store<S, G, A>) => T,
    options?: SelectorOptions<T>,
): T {
    const equality = options?.equalityFn ?? defaultEquality;

    // The selector and equality of the last *committed* render. The tracking
    // effect reads these, so a render React discards can never leave the
    // subscription pointing at its selector. An inline arrow is a new
    // identity every render; keeping it out of the subscription's
    // dependencies avoids tearing down the subscription on every render.
    const selectorRef = useRef(selector);
    const equalityRef = useRef<EqualityFn<T>>(equality);

    // `value` is what the component receives. It must be stable between
    // renders unless the selection genuinely changed.
    const valueRef = useRef<{ current: T } | null>(null);
    const runnerRef = useRef<EffectRunner | null>(null);
    const notifyRef = useRef<(() => void) | null>(null);

    // React compares consecutive `getSnapshot()` results with Object.is and
    // skips the render when they match. A selector returning a live reactive
    // object hands back the *same identity* after an in-place mutation, so
    // returning the value itself as the snapshot would make React bail out
    // even though the contents changed.
    //
    // So the snapshot is a version token, bumped whenever the selection
    // changes, and the value is returned separately.
    const versionRef = useRef(0);

    /** Run the committed selector and store the result if it changed. */
    const readIntoRef = useCallback(() => {
        const next = selectorRef.current(store);
        if (valueRef.current === null) {
            valueRef.current = { current: next };
            return true;
        }
        if (equalityRef.current(valueRef.current.current, next)) return false;
        valueRef.current = { current: next };
        return true;
    }, [store]);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            // Dispose any runner left over from a previous store.
            runnerRef.current?.stop();
            notifyRef.current = onStoreChange;

            const rendered = valueRef.current;

            // The effect body both computes the value and registers the
            // dependencies it read. The scheduler fires when any of them
            // change; re-invoking the runner recomputes *and* re-tracks, so a
            // selector whose dependencies vary between runs stays correct.
            let changed = false;
            const runner: EffectRunner = effect(
                () => {
                    changed = readIntoRef();
                },
                {
                    scheduler: () => {
                        changed = false;
                        runner();
                        // Called after the runner has finished, so tracking is
                        // already restored and React's re-render is not
                        // recorded as a dependency.
                        if (changed) {
                            versionRef.current++;
                            onStoreChange();
                        }
                    },
                },
            );
            runnerRef.current = runner;

            // The store may have changed between render and subscribe. React
            // re-reads the snapshot after subscribing and re-renders if it
            // moved, so bump it when the first tracked run disagrees with
            // what was rendered.
            if (valueRef.current !== rendered) versionRef.current++;

            return () => {
                runner.stop();
                if (runnerRef.current === runner) runnerRef.current = null;
            };
        },
        [readIntoRef],
    );

    const getVersion = useCallback(() => versionRef.current, []);
    useSyncExternalStore(subscribe, getVersion, getVersion);

    // Compute what this render shows without touching the dependency graph:
    // renders can be discarded or replayed, so subscribing belongs in the
    // commit phase below.
    let value: T;
    const selectorChanged = selectorRef.current !== selector;
    if (valueRef.current === null) {
        // First render (and SSR): lazily initialise the cache.
        valueRef.current = { current: untrack(() => selector(store)) };
        value = valueRef.current.current;
    } else if (selectorChanged) {
        // A different selector can read different state (a closure over a
        // prop, say), so the cached value belongs to the old one.
        const previous = valueRef.current.current;
        const next = untrack(() => selector(store));
        value = equality(previous, next) ? previous : next;
    } else {
        value = valueRef.current.current;
    }

    useIsomorphicLayoutEffect(() => {
        equalityRef.current = equality;
        if (selectorRef.current === selector) return;
        selectorRef.current = selector;
        if (valueRef.current?.current !== value) {
            valueRef.current = { current: value };
        }

        // Re-track against the committed selector. If the state changed
        // since render, the runner's result differs from what was shown and
        // the component re-renders.
        const runner = runnerRef.current;
        if (runner === null || !runner.active) return;
        runner();
        // Compare the values themselves: the default equality treats every
        // object as changed (for in-place mutation), which here would
        // re-render forever.
        if (!Object.is(valueRef.current?.current, value)) {
            versionRef.current++;
            notifyRef.current?.();
        }
    });

    useDebugValue(value);
    return value;
}

/**
 * Subscribe to a whole store.
 *
 * Every consumer re-renders on any change anywhere in the store, so prefer
 * {@link useQuantaSelector} in components that read a slice. This hook remains
 * useful for small stores and for components that genuinely read most of the
 * state.
 *
 * @returns The live store instance.
 */
export function useQuantaStore<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
>(store: Store<S, G, A>): Store<S, G, A> {
    // Checked during render so the error reaches an error boundary; thrown
    // from subscribe, it lands in the commit phase instead.
    if (
        typeof (store as { subscribe?: unknown } | null)?.subscribe !==
        'function'
    ) {
        throw new Error(
            'useQuantaStore: expected a store with subscribe(). To pass a store ' +
                'definition from defineStore(), use useQuanta(definition) instead.',
        );
    }
    const versionRef = useRef(0);

    const subscribe = useCallback(
        (onStoreChange: () => void) =>
            store.subscribe(() => {
                versionRef.current++;
                onStoreChange();
            }),
        [store],
    );

    const getSnapshot = useCallback(() => versionRef.current, []);

    useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return store;
}
