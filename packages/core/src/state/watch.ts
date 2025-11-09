import { reactiveEffect } from '../core/effect';
import { logger } from '../services/logger-service';

/**
 * Options for configuring a watcher.
 *
 *
 * @property {boolean} [deep]
 * Whether to perform deep watching (i.e., recursively track nested object changes).
 * When `true`, changes inside nested structures are detected using polling and JSON diffing.
 *
 * @property {boolean} [immediate]
 * Whether to invoke the watcher callback immediately upon setup,
 * rather than waiting for the first change.
 */
interface WatchOptions {
    deep?: boolean;
    immediate?: boolean;
}

const watch = <T>(
    source: () => T,
    callback: (value: T, oldValue?: T) => void,
    options: WatchOptions = {},
) => {
    const { deep = false, immediate = true } = options;
    let oldValue: T | undefined;
    if (!deep) {
        // effect-based (shallow deps)
        try {
            const effect = reactiveEffect(() => {
                try {
                    const value = source();
                    if (immediate && oldValue === undefined) {
                        callback(value, value);
                    } else if (oldValue !== undefined && value !== oldValue) {
                        callback(value, oldValue);
                    }
                    oldValue = value;
                } catch (error) {
                    logger.error(
                        `Watch: Failed to execute watch source function: ${error instanceof Error ? error.message : String(error)}`,
                    );
                    throw error;
                }
            });
            return effect;
        } catch (error) {
            logger.error(
                `Watch: Failed to create watcher: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    } else {
        // Deep mode: Poll source, compare JSON for changes (nested-safe)
        const getJson = (val: T) => JSON.stringify(val);
        let pollId: NodeJS.Timeout | null = null;
        const pollMs = 100;

        const poll = () => {
            try {
                const value = source();
                const json = getJson(value);
                if (oldValue === undefined) {
                    if (immediate) callback(value, value);
                } else {
                    const oldJson = getJson(oldValue);
                    if (json !== oldJson) {
                        callback(value, oldValue);
                    }
                }
                oldValue = value;
            } catch (error) {
                logger.warn(
                    `Watch (deep): Poll failed: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        };

        poll();
        pollId = setInterval(poll, pollMs);

        // Return cleanup
        return () => {
            if (pollId) {
                clearInterval(pollId);
                pollId = null;
            }
        };
    }
};

export default watch;
