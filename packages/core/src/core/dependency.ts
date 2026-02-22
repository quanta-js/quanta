import { StoreSubscriber } from 'type/store-types';
import { logger } from '../services/logger-service';

export class Dependency<S = any> {
    private subscribers: Set<StoreSubscriber<S>>;

    constructor() {
        this.subscribers = new Set();
    }

    depend(callback: StoreSubscriber<S> | null) {
        try {
            if (callback) {
                this.subscribers.add(callback);
            }
        } catch (error) {
            logger.error(
                `Dependency: Failed to add dependency: ${error instanceof Error ? error.message : String(error)}`,
            );
            // throw error;
        }
    }

    notify(snapshot?: S): void {
        try {
            const activeSubs = new Set(this.subscribers);
            activeSubs.forEach((subscriber) => {
                try {
                    if (snapshot !== undefined) {
                        subscriber(snapshot); // Pass fresh state if provided (framework opt-in)
                    } else {
                        subscriber(); // Legacy no-arg compat
                    }
                } catch (error) {
                    logger.warn(
                        // Warn only—isolated: Don't break other subs
                        `Dependency: Subscriber callback failed: ${error instanceof Error ? error.message : String(error)}`,
                    );
                    // Continue chain
                }
            });
        } catch (error) {
            logger.error(
                `Dependency: Failed to notify subscribers: ${error instanceof Error ? error.message : String(error)}`,
            );
            // throw error;
        }
    }

    remove(callback: StoreSubscriber<S>) {
        try {
            this.subscribers.delete(callback);
        } catch (error) {
            logger.error(
                `Dependency: Failed to remove dependency: ${error instanceof Error ? error.message : String(error)}`,
            );
            // throw error;
        }
    }

    clear() {
        try {
            this.subscribers.clear();
        } catch (error) {
            logger.error(
                `Dependency: Failed to clear dependencies: ${error instanceof Error ? error.message : String(error)}`,
            );
            // throw error;
        }
    }

    get getSubscribers() {
        return new Set(this.subscribers);
    }
}
