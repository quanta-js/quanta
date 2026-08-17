import { Dependency } from './dependency';
import { logger } from '../services/logger-service';
import { __DEV__ } from '../utils/env';
import type { EffectFunction } from '../type/store-types';
import { bubbleTrigger, parentMap } from '../utils/deep-trigger';

export interface EffectOptions {
    /** Custom scheduler invoked instead of the effect when dependencies change. */
    scheduler?: (effect: EffectRunner) => void;
    /** If true, the effect will not run immediately upon creation. */
    lazy?: boolean;
    /**
     * Run the scheduler immediately when a dependency changes, even inside an
     * active `batchEffects()`, instead of deferring it to the batch flush.
     *
     * For an ordinary effect, deferring is correct — it is how N writes
     * inside one batch collapse into one subscriber notification. A
     * `computed`'s scheduler is different: it only flips a `dirty` flag, an
     * idempotent, side-effect-free step with no reason to wait. If it *is*
     * deferred, a plain effect that also depends on the same source (e.g. a
     * store's coarse "something changed" notifier) can run first in the same
     * flush pass and read the computed before it has been invalidated —
     * serving a value that is one write stale. Marking the flag eagerly
     * closes that window; the scheduler's own `trigger()` call for
     * *downstream* subscribers still goes through normal batching.
     */
    eager?: boolean;
    /**
     * Called when the effect is stopped. Used by {@link effectScope} and by
     * framework adapters that need to release resources with the effect.
     */
    onStop?: () => void;
}

/**
 * A disposable effect function with a `stop()` method for cleanup.
 * Calling the function re-runs the effect; calling `stop()` permanently
 * unsubscribes and prevents further execution.
 */
export interface EffectRunner extends EffectFunction {
    /** Whether this effect is currently active (not stopped). */
    active: boolean;
    /** Permanently stop this effect and remove it from all dependency sets. */
    stop: () => void;
    /** Custom scheduler (if provided). */
    scheduler?: (effect: EffectRunner) => void;
    /** Whether the scheduler runs immediately, bypassing batch deferral. */
    eager?: boolean;
}

/** target -> (property -> Dependency) */
const targetMap = new WeakMap<object, Map<string | symbol, Dependency>>();
export { targetMap };

let activeEffect: EffectFunction | null = null;

/**
 * Per-effect set of `Dependency` objects the effect is subscribed to.
 * Used to clean up stale subscriptions before each re-run.
 */
const effectDeps = new WeakMap<EffectFunction, Set<Dependency>>();

let batchDepth = 0;
const effectQueue = new Set<EffectFunction>();
const effectStack: EffectFunction[] = [];

/** Guards against a pathological effect graph re-queueing itself forever. */
const MAX_FLUSH_PASSES = 100;

/* ------------------------------------------------------------------ *
 * Tracking control
 * ------------------------------------------------------------------ */

/**
 * Temporarily pause dependency tracking.
 * Reactive reads while tracking is paused do NOT register dependencies.
 * Must be paired with {@link resumeTracking}.
 *
 * @returns The previously active effect, to pass to `resumeTracking()`.
 */
export function pauseTracking(): EffectFunction | null {
    const prev = activeEffect;
    activeEffect = null;
    return prev;
}

/**
 * Resume dependency tracking after a {@link pauseTracking} call.
 *
 * @param prev - The return value from the matching `pauseTracking()` call.
 */
export function resumeTracking(prev: EffectFunction | null): void {
    activeEffect = prev;
}

/**
 * Run `fn` without registering any of its reactive reads as dependencies.
 *
 * Use this inside an effect when you need to read state without subscribing
 * to it — for example reading a counter you are about to write.
 *
 * @example
 * ```ts
 * effect(() => {
 *     console.log(state.visible);          // tracked
 *     untrack(() => console.log(state.id)); // NOT tracked
 * });
 * ```
 */
export function untrack<T>(fn: () => T): T {
    const prev = pauseTracking();
    try {
        return fn();
    } finally {
        resumeTracking(prev);
    }
}

/* ------------------------------------------------------------------ *
 * Notification: the single path every trigger flows through
 * ------------------------------------------------------------------ */

/**
 * Schedule (or immediately run) one effect.
 *
 * This is the **only** place an effect is invoked in response to a state
 * change. Routing every notification through here is what makes batching and
 * custom schedulers apply uniformly — including to deep/bubbled triggers,
 * which previously called `Dependency.notify()` directly and so silently
 * bypassed both mechanisms.
 *
 * @param effect - The subscriber to run.
 * @param errors - Collector; a throwing subscriber must not prevent the
 *                 remaining subscribers from running.
 */
function scheduleEffect(effect: EffectFunction, errors: unknown[]): void {
    const runner = effect as EffectRunner;
    if (runner.active === false) return;

    // Inside a batch we only record the effect; the outermost batch flushes it.
    // The Set dedupes, which is what collapses N writes into one run. An
    // `eager` effect (a computed's invalidation) skips this queue — see
    // {@link EffectOptions.eager}.
    if (batchDepth > 0 && !runner.eager) {
        effectQueue.add(effect);
        return;
    }

    try {
        if (runner.scheduler) {
            runner.scheduler(runner);
        } else {
            // A self-triggering effect would recurse forever. Detect it at the
            // point of re-entry rather than blowing the stack.
            if (effectStack.includes(effect)) {
                throw new Error(
                    `Circular dependency detected: effect "${
                        effect.name || 'anonymous'
                    }" triggered itself.`,
                );
            }
            effect();
        }
    } catch (error) {
        errors.push(error);
    }
}

/**
 * Notify every subscriber of a dependency.
 *
 * Subscribers are snapshotted before iteration: an effect re-tracking itself
 * mutates the live Set, and iterating a Set while it is being added to loops
 * forever per the ES specification.
 */
export function notifyDependency(dep: Dependency, errors: unknown[]): void {
    const subscribers = dep.getSubscribers;
    if (subscribers.size === 0) return;

    for (const subscriber of [...subscribers]) {
        scheduleEffect(subscriber, errors);
    }
}

/**
 * Rethrow the first collected error, after reporting the rest.
 *
 * One misbehaving subscriber should not silently swallow the others' failures,
 * but it also should not prevent them from running — so errors are collected
 * during the pass and surfaced afterwards.
 */
function settleErrors(errors: unknown[]): void {
    if (errors.length === 0) return;

    if (__DEV__ && errors.length > 1) {
        for (let i = 1; i < errors.length; i++) {
            logger.error(
                `Effect: additional subscriber failure: ${describe(errors[i])}`,
            );
        }
    }
    throw errors[0];
}

function describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/* ------------------------------------------------------------------ *
 * Batching
 * ------------------------------------------------------------------ */

/**
 * Batch multiple state mutations so dependent effects run once.
 *
 * Supports nesting — effects flush only when the outermost batch completes.
 * If the callback throws, queued triggers from the failed batch are discarded.
 *
 * @param fn - Mutations to apply as one unit.
 * @returns Whatever `fn` returns, so the batch can wrap a value-producing
 *          operation rather than only side effects.
 *
 * @example
 * ```ts
 * const id = batchEffects(() => {
 *     state.a = 1;
 *     state.b = 2;  // dependents of both a & b run once, not twice
 *     return state.nextId++;
 * });
 * ```
 */
export function batchEffects<T>(fn: () => T): T {
    batchDepth++;
    let success = false;
    try {
        const result = fn();
        success = true;
        return result;
    } finally {
        batchDepth--;
        if (batchDepth === 0) {
            if (success) {
                flushBatch();
            } else {
                // The batch aborted; its pending triggers describe a state that
                // was never committed, so drop them.
                effectQueue.clear();
            }
        }
    }
}

/**
 * Drain the batch queue.
 *
 * An effect may write state as it runs, queueing further effects. We therefore
 * loop until the queue is empty rather than iterating a single snapshot, with
 * a pass cap so a pathological cycle fails loudly instead of hanging.
 */
function flushBatch(): void {
    const errors: unknown[] = [];
    let passes = 0;

    while (effectQueue.size > 0) {
        if (++passes > MAX_FLUSH_PASSES) {
            effectQueue.clear();
            errors.push(
                new Error(
                    `Batch flush exceeded ${MAX_FLUSH_PASSES} passes — an effect is likely writing state it also depends on.`,
                ),
            );
            break;
        }

        const pass = [...effectQueue];
        effectQueue.clear();

        for (const effect of pass) {
            const runner = effect as EffectRunner;
            if (runner.active === false) continue;
            try {
                if (runner.scheduler) {
                    runner.scheduler(runner);
                } else {
                    effect();
                }
            } catch (error) {
                errors.push(error);
            }
        }
    }

    settleErrors(errors);
}

/**
 * Resolve once all currently-queued effects have flushed.
 *
 * Mirrors Vue's `nextTick`, giving callers a way to await the settled state
 * after a mutation without polling.
 */
export function nextTick(fn?: () => void): Promise<void> {
    return Promise.resolve().then(() => {
        fn?.();
    });
}

/* ------------------------------------------------------------------ *
 * Trigger / track
 * ------------------------------------------------------------------ */

/**
 * Notify dependents that `prop` on `target` changed, then bubble to parents.
 *
 * Both the direct notification and the bubbled ones go through
 * {@link notifyDependency}, so batching and schedulers apply consistently at
 * every depth.
 */
export function trigger(target: object, prop: string | symbol): void {
    const errors: unknown[] = [];

    const depsMap = targetMap.get(target);
    if (depsMap !== undefined) {
        const dep = depsMap.get(prop);
        if (dep !== undefined) notifyDependency(dep, errors);
    }

    // Only walk upwards when this object is actually attached to a parent;
    // root-level state has no parents and this check keeps the common case free.
    if (parentMap.has(target)) {
        bubbleTrigger(target, targetMap, (dep) =>
            notifyDependency(dep, errors),
        );
    }

    settleErrors(errors);
}

/**
 * Register the currently-running effect as a dependent of `target[prop]`.
 *
 * **Hot path.** The early return when nothing is tracking is the single most
 * important optimisation in the library: a read outside an effect — which is
 * the overwhelming majority of reads, including every cached computed access —
 * now costs one null check instead of a WeakMap lookup, a Map lookup, a
 * `Dependency` allocation and a `Set.add`. Creating those structures with no
 * subscriber to put in them was pure waste; `trigger` already no-ops when no
 * dependency exists for a property.
 */
export function track(target: object, prop: string | symbol): void {
    if (activeEffect === null) return;

    let depsMap = targetMap.get(target);
    if (depsMap === undefined) {
        depsMap = new Map();
        targetMap.set(target, depsMap);
    }

    let dep = depsMap.get(prop);
    if (dep === undefined) {
        dep = new Dependency();
        depsMap.set(prop, dep);
    }

    dep.depend(activeEffect);

    // Record the dep on the effect so a later re-run can unsubscribe from it.
    const deps = effectDeps.get(activeEffect);
    if (deps !== undefined) deps.add(dep);
}

/* ------------------------------------------------------------------ *
 * Effects
 * ------------------------------------------------------------------ */

/**
 * Create a reactive effect that tracks its dependencies automatically and
 * re-runs when any of them change.
 *
 * Returns an `EffectRunner` — a callable with a `.stop()` method. Call
 * `.stop()` to permanently unsubscribe and prevent further execution.
 *
 * @example
 * ```ts
 * const runner = effect(() => console.log(state.count)); // tracks state.count
 * state.count++;  // logs
 * runner.stop();
 * state.count++;  // does not log
 * ```
 */
export function reactiveEffect(
    effectFn: EffectFunction,
    options?: EffectOptions,
): EffectRunner {
    const deps = new Set<Dependency>();

    const wrappedEffect = (() => {
        if (!wrappedEffect.active) return;

        if (effectStack.includes(wrappedEffect)) {
            const message = `Circular dependency detected: effect "${
                effectFn.name || 'anonymous'
            }" triggered itself. Stack: ${effectStack
                .map((e) => e.name || 'anonymous')
                .join(' -> ')}`;
            if (__DEV__) logger.error(`Effect: ${message}`);
            throw new Error(message);
        }

        // Drop stale subscriptions before re-tracking. Without this an effect
        // whose dependencies change over time accumulates subscribers forever.
        for (const dep of deps) dep.remove(wrappedEffect);
        deps.clear();

        effectStack.push(wrappedEffect);
        const previousActive = activeEffect;
        activeEffect = wrappedEffect;
        try {
            effectFn();
        } finally {
            effectStack.pop();
            activeEffect = previousActive;
        }
    }) as EffectRunner;

    wrappedEffect.active = true;

    /**
     * Permanently stop this effect: unsubscribe from every dependency, block
     * future execution, and release the bookkeeping entry. Idempotent.
     */
    wrappedEffect.stop = () => {
        if (!wrappedEffect.active) return;
        wrappedEffect.active = false;
        for (const dep of deps) dep.remove(wrappedEffect);
        deps.clear();
        effectDeps.delete(wrappedEffect);
        effectQueue.delete(wrappedEffect);
        options?.onStop?.();
    };

    if (options?.scheduler) {
        wrappedEffect.scheduler = options.scheduler;
    }
    if (options?.eager) {
        wrappedEffect.eager = true;
    }

    effectDeps.set(wrappedEffect, deps);

    // Register with the enclosing scope, if any, so the scope can dispose it.
    activeScope?.add(wrappedEffect);

    if (!options?.lazy) {
        wrappedEffect();
    }
    return wrappedEffect;
}

/** Public alias — `effect()` is the name every other reactivity library uses. */
export const effect = reactiveEffect;

/* ------------------------------------------------------------------ *
 * Effect scopes
 * ------------------------------------------------------------------ */

/**
 * A disposable group of effects.
 *
 * Framework adapters and feature modules typically create several effects that
 * share a lifetime. A scope collects them so they can be released with one
 * call instead of tracking each disposer by hand.
 */
export interface EffectScope {
    /** Run `fn` with this scope active; effects created inside are captured. */
    run<T>(fn: () => T): T;
    /** Stop every effect created inside this scope. Idempotent. */
    stop(): void;
    /** Manually attach an already-created runner to this scope. */
    add(runner: EffectRunner): void;
    /** Whether the scope is still accepting effects. */
    readonly active: boolean;
}

let activeScope: EffectScope | null = null;

/**
 * Create an {@link EffectScope}.
 *
 * @example
 * ```ts
 * const scope = effectScope();
 * scope.run(() => {
 *     effect(() => console.log(state.a));
 *     watch(() => state.b, onChange);
 * });
 * scope.stop(); // both released
 * ```
 */
export function effectScope(): EffectScope {
    const runners = new Set<EffectRunner>();
    let active = true;

    const scope: EffectScope = {
        get active() {
            return active;
        },
        add(runner) {
            if (active) runners.add(runner);
        },
        run(fn) {
            if (!active) {
                if (__DEV__) {
                    logger.warn(
                        'EffectScope: run() called on a stopped scope; effects will not be tracked.',
                    );
                }
                return fn();
            }
            const previous = activeScope;
            activeScope = scope;
            try {
                return fn();
            } finally {
                activeScope = previous;
            }
        },
        stop() {
            if (!active) return;
            active = false;
            for (const runner of runners) runner.stop();
            runners.clear();
        },
    };

    return scope;
}
