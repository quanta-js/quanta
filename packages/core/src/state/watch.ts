import { reactiveEffect } from '../core/effect';
import { logger } from '../services/logger-service';

const watch = <T>(source: () => T, callback: (value: T) => void) => {
    try {
        const effect = reactiveEffect(() => {
            try {
                const value = source();

                try {
                    callback(value); // Run callback when source changes
                } catch (error) {
                    logger.error(
                        `Watch: Failed to execute watch callback: ${error instanceof Error ? error.message : String(error)}`,
                    );
                    throw error;
                }
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
};

export default watch;
