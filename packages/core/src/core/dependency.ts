import type { EffectFunction } from '../type/store-types';

/**
 * The set of subscribers (effects, watchers, store listeners) for one
 * reactive property.
 *
 * This class is deliberately a dumb container. Notification policy —
 * batching, custom schedulers, circular-dependency detection and error
 * collection — lives in `core/effect.ts` behind `notifyDependency()`, so that
 * every trigger in the library, including deep/bubbled ones, goes through
 * exactly one code path.
 *
 * An earlier version exposed a `notify()` method that invoked subscribers
 * directly. `bubbleTrigger` used it, which meant nested mutations silently
 * escaped `batchEffects()` and bypassed each effect's scheduler. Keeping the
 * invocation logic out of this class makes that mistake unrepresentable.
 */
export class Dependency {
    private subscribers: Set<EffectFunction> = new Set();

    /** Subscribe a callback to this dependency. */
    depend(callback: EffectFunction | null | undefined): void {
        if (callback) this.subscribers.add(callback);
    }

    /** Unsubscribe a callback from this dependency. */
    remove(callback: EffectFunction): void {
        this.subscribers.delete(callback);
    }

    /** Drop every subscriber. */
    clear(): void {
        this.subscribers.clear();
    }

    /** How many subscribers are attached. */
    get size(): number {
        return this.subscribers.size;
    }

    /**
     * The live subscriber set.
     *
     * Callers must snapshot before iterating: subscribers commonly remove and
     * re-add themselves while running (that is how dependency re-tracking
     * works), and mutating a `Set` during iteration loops forever per the ES
     * specification.
     */
    get getSubscribers(): ReadonlySet<EffectFunction> {
        return this.subscribers;
    }
}
