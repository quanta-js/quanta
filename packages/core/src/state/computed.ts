import { reactiveEffect, track, trigger } from '../core/effect';
import { logger } from '../services/logger-service';

const computed = <G>(getter: () => G) => {
    try {
        let value: G;
        let dirty = true;

        // The effect re-runs when dependencies change, marking dirty for lazy recompute
        reactiveEffect(() => {
            try {
                // Run getter to track dependencies
                const newValue = getter();
                if (dirty) {
                    // First run or explicit recompute — store the value
                    value = newValue;
                    dirty = false;
                } else {
                    // Dependency changed — mark dirty for lazy recompute
                    dirty = true;
                    // Notify anyone watching this computed's value
                    trigger(obj, 'value');
                }
            } catch (error) {
                logger.error(
                    `Computed: Failed to compute value: ${error instanceof Error ? error.message : String(error)}`,
                );
                throw error;
            }
        });

        const obj = {
            get value() {
                try {
                    if (dirty) {
                        // Lazy recompute — only runs when accessed AND dirty
                        value = getter();
                        dirty = false;
                    }
                    track(obj, 'value'); // Track access to the computed value
                    return value;
                } catch (error) {
                    logger.error(
                        `Computed: Failed to get computed value: ${error instanceof Error ? error.message : String(error)}`,
                    );
                    throw error;
                }
            },
        };

        return obj;
    } catch (error) {
        logger.error(
            `Computed: Failed to create computed value: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
};

export default computed;
