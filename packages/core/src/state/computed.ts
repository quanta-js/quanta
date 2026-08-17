import {
    reactiveEffect,
    track,
    trigger,
    type EffectRunner,
} from '../core/effect';
import { logger } from '../services/logger-service';
import { __DEV__ } from '../utils/env';

/**
 * A lazily-evaluated, cached derived value.
 */
export interface ComputedRef<T> {
    /** The current value. Recomputes only when a dependency has changed. */
    readonly value: T;
    /** Read without registering a dependency on the calling effect. */
    peek(): T;
    /** Force the next read to recompute. */
    invalidate(): void;
    /** Release the underlying effect. Idempotent. */
    stop(): void;
    /** Whether a recompute is pending. */
    readonly dirty: boolean;
}

/**
 * Create a cached derived value.
 *
 * The getter runs lazily — nothing is computed until `.value` is first read —
 * and the result is cached until one of the dependencies the getter touched
 * actually changes. Reading `.value` from inside an effect subscribes that
 * effect to the computed, so derived values compose into chains.
 *
 * @example
 * ```ts
 * const total = computed(() => cart.items.reduce((n, i) => n + i.price, 0));
 * total.value;   // computes
 * total.value;   // cached — no recompute
 * cart.items.push(item);
 * total.value;   // recomputes once
 * ```
 */
const computed = <T>(getter: () => T): ComputedRef<T> => {
    let value: T;
    let dirty = true;
    let stopped = false;

    /**
     * Recompute if needed.
     *
     * Kept separate from the accessor so `peek()` and `value` share it without
     * duplicating the dirty-check.
     */
    const evaluate = (): T => {
        if (dirty && !stopped) {
            // `runner` re-tracks the getter's dependencies as it runs.
            // Clear the flag first: if the getter throws we want the next read
            // to retry rather than serve a value that was never assigned.
            dirty = false;
            try {
                runner();
            } catch (error) {
                dirty = true;
                if (__DEV__) {
                    logger.error(
                        `Computed: getter threw: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    );
                }
                throw error;
            }
        }
        return value;
    };

    const ref: ComputedRef<T> = {
        get value() {
            const result = evaluate();
            // Subscribe the *calling* effect to this computed. Done after
            // evaluate() so the getter's own dependencies are attributed to the
            // computed's runner, not to the caller.
            track(ref, 'value');
            return result;
        },

        get dirty() {
            return dirty;
        },

        peek: () => evaluate(),

        invalidate() {
            if (dirty) return;
            dirty = true;
            trigger(ref, 'value');
        },

        stop() {
            if (stopped) return;
            stopped = true;
            runner.stop();
        },
    };

    const runner: EffectRunner = reactiveEffect(
        () => {
            value = getter();
        },
        {
            // Nothing is computed until the first read.
            lazy: true,
            // A dependency changed. Do NOT recompute here — that would defeat
            // laziness and do work nobody has asked for. Just mark dirty and
            // tell downstream subscribers, which recompute on their next read.
            scheduler: () => {
                if (dirty) return; // already pending; don't re-notify
                dirty = true;
                trigger(ref, 'value');
            },
        },
    );

    return ref;
};

export default computed;
