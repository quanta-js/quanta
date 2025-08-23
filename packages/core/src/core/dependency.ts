import { logger } from '../services/logger-service';

export class Dependency {
    [x: string]: any;
    private subscribers: Set<Function>;

    constructor() {
        this.subscribers = new Set();
    }

    depend(callback: Function | null) {
        try {
            if (callback) {
                this.subscribers.add(callback);
            }
        } catch (error) {
            logger.error(
                `Dependency: Failed to add dependency: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }

    notify() {
        try {
            this.subscribers.forEach((subscriber) => {
                try {
                    subscriber();
                } catch (error) {
                    logger.error(
                        `Dependency: Failed to notify subscriber: ${error instanceof Error ? error.message : String(error)}`,
                    );
                    throw error;
                }
            });
        } catch (error) {
            logger.error(
                `Dependency: Failed to notify subscribers: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }

    remove(callback: Function) {
        try {
            this.subscribers.delete(callback);
        } catch (error) {
            logger.error(
                `Dependency: Failed to remove dependency: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }

    clear() {
        try {
            this.subscribers.clear();
        } catch (error) {
            logger.error(
                `Dependency: Failed to clear dependencies: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }

    get getSubscribers() {
        return this.subscribers;
    }
}
