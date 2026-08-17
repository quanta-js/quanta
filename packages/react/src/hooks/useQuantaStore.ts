'use client';

import {
    useCallback,
    useDebugValue,
    useRef,
    useSyncExternalStore,
} from 'react';
import {
    reactiveEffect,
    untrack,
    type EffectRunner,
    type RawActions,
    type StoreInstance,
} from '@quantajs/core';

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
 * Shallow structural equality for objects and arrays, one level deep.
 *
 * The standard companion to a selector that projects state:
 * ```ts
 * const { name, email } = useQuantaSelector(
 *     store,
 *     (s) => ({ name: s.name, email: s.email }),
 *     { equalityFn: shallow },
 * );
 * ```
 */
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
    S extends object,
    GDefs extends Record<string, (state: S) => unknown> = Record<
        string,
        (state: S) => unknown
    >,
    A extends RawActions = RawActions,
    T = unknown,
>(
    store: StoreInstance<S, GDefs, A>,
    selector: (store: StoreInstance<S, GDefs, A>) => T,
    options?: SelectorOptions<T>,
): T {
    // Latest selector/equality without making them subscription dependencies.
    // An inline arrow selector is a new identity on every render; keying the
    // subscription on it would tear down and recreate the store subscription
    // on every single render.
    const selectorRef = useRef(selector);

    const equalityRef = useRef<EqualityFn<T>>(
        options?.equalityFn ?? defaultEquality,
    );
    equalityRef.current = options?.equalityFn ?? defaultEquality;

    // Whether the selector changed identity this render. A selector closing
    // over a prop (`s => mode === 'a' ? s.a : s.b`) is a different function
    // *and* reads different state, so both the cached value and the tracked
    // dependency set belong to the previous one and must be rebuilt.
    const selectorChanged = selectorRef.current !== selector;
    selectorRef.current = selector;

    // `value` is the snapshot React reads. It must be stable between renders
    // unless the selection genuinely changed, or useSyncExternalStore will
    // loop forever ("getSnapshot should be cached").
    const valueRef = useRef<{ current: T } | null>(null);
    const runnerRef = useRef<EffectRunner | null>(null);

    // React compares consecutive `getSnapshot()` results with Object.is and
    // skips the render when they match. A selector returning a live reactive
    // object hands back the *same identity* after an in-place mutation, so
    // returning the value itself as the snapshot would make React bail out
    // even though the contents changed.
    //
    // So the snapshot is a version token, bumped whenever the selection
    // changes, and the value is returned separately. React re-renders on the
    // token; the component reads the freshly-computed value.
    const versionRef = useRef(0);

    /** Run the selector inside the tracking effect and store the result. */
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

            // The effect body both computes the value and registers the
            // dependencies it read. The scheduler fires when any of them
            // change; re-invoking the runner recomputes *and* re-tracks, so a
            // selector whose dependencies vary between runs stays correct.
            let changed = false;
            const runner: EffectRunner = reactiveEffect(
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

            return () => {
                runner.stop();
                if (runnerRef.current === runner) runnerRef.current = null;
            };
        },
        [readIntoRef],
    );

    // Rebuild eagerly when the selector changed, so *this* render already sees
    // the new selection and the runner re-tracks against the new dependencies.
    // Re-running the runner recomputes and re-tracks in one step; it never
    // notifies React, because notification lives in the scheduler.
    if (selectorChanged && valueRef.current !== null) {
        const runner = runnerRef.current;
        if (runner !== null && runner.active) {
            runner();
        } else {
            untrack(() => {
                valueRef.current = { current: selector(store) };
            });
        }
    }

    const getVersion = useCallback(() => versionRef.current, []);

    useSyncExternalStore(subscribe, getVersion, getVersion);

    // Before the subscription exists (first render, and during SSR) there is
    // no computed value yet. Read untracked so this does not leak a dependency
    // into whatever effect might be running around us.
    if (valueRef.current === null) {
        untrack(() => {
            valueRef.current = { current: selectorRef.current(store) };
        });
    }

    // Non-null by construction: either the runner populated it, or the
    // untracked read directly above did.
    const value = valueRef.current!.current;
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
    S extends object,
    GDefs extends Record<string, (state: S) => unknown> = Record<
        string,
        (state: S) => unknown
    >,
    A extends RawActions = RawActions,
>(store: StoreInstance<S, GDefs, A>): StoreInstance<S, GDefs, A> {
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
