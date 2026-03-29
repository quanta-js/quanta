import type { EffectFunction } from '../type/store-types';
import { logger } from '../services/logger-service';

/**
 * Manages a set of subscribers (effects or watchers) for a specific reactive property.
 * When a property is modified, its Dependency notifies all subscribers.
 */
export class Dependency {
    private subscribers: Set<EffectFunction>;

    constructor() {
        this.subscribers = new Set();
    }

    /**
     * Subscribe a callback to this dependency.
     */
    depend(callback: EffectFunction | null) {
        if (callback) {
            this.subscribers.add(callback);
        }
    }

    /**
     * Notify all subscribers that the property has changed.
     */
    notify(): void {
        try {
            // Snapshot subscribers into an array BEFORE iterating.
            // Subscribers (effects) may remove/re-add themselves during execution;
            // iterating the live Set would cause an infinite loop per ES spec.
            const subscriberSnapshot = [...this.subscribers];
            for (const subscriber of subscriberSnapshot) {
                try {
                    subscriber();
                } catch (error) {
                    logger.warn(
                        `Dependency: Subscriber callback failed: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            }
        } catch (error) {
            logger.error(
                `Dependency: Failed to notify subscribers: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }

    /**
     * Unsubscribe a callback from this dependency.
     */
    remove(callback: EffectFunction) {
        this.subscribers.delete(callback);
    }

    /**
     * Clear all subscribers.
     */
    clear() {
        this.subscribers.clear();
    }

    /**
     * Get a reference to the subscribers.
     * Returns the internal set of subscribers.
     * Note: iterate this set carefully as it may be modified during iteration.
     */
    get getSubscribers(): ReadonlySet<EffectFunction> {
        return this.subscribers;
    }
}
