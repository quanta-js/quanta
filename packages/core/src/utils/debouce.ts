import { logger } from '../services/logger-service';

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
): T & { flush: () => void; cancel: () => void } {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastArgs: Parameters<T> | undefined;

    const debounced = ((...args: Parameters<T>) => {
        try {
            lastArgs = args;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                try {
                    if (lastArgs) {
                        func(...lastArgs);
                        lastArgs = undefined;
                    }
                } catch (error) {
                    logger.error(
                        `Debounce: Failed to execute debounced function: ${error instanceof Error ? error.message : String(error)}`,
                    );
                    throw error;
                }
            }, wait);
        } catch (error) {
            logger.error(
                `Debounce: Failed to schedule debounced function: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }) as T & { flush: () => void; cancel: () => void };

    debounced.flush = () => {
        try {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = undefined;
            }
            if (lastArgs) {
                func(...lastArgs);
                lastArgs = undefined;
            }
        } catch (error) {
            logger.error(
                `Debounce: Failed to flush debounced function: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    };

    debounced.cancel = () => {
        try {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = undefined;
            }
            lastArgs = undefined;
        } catch (error) {
            logger.error(
                `Debounce: Failed to cancel debounced function: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    };

    return debounced;
}
