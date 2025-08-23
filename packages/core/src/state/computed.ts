import { reactiveEffect, track } from '../core/effect';
import { logger } from '../services/logger-service';

const computed = <G>(getter: () => G) => {
    try {
        let value: G;
        let dirty = true;

        // Wrap the getter in a reactive effect to track dependencies
        const effect = reactiveEffect(() => {
            try {
                value = getter();
                dirty = false; // Reset the dirty flag after computing
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
                        effect(); // Run the effect to compute the value if dirty
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
