import { reactiveEffect, track, trigger } from '../core/effect';
import { logger } from '../services/logger-service';

const computed = <G>(getter: () => G) => {
    try {
        let value: G;
        let dirty = true;

        const obj = {
            get value() {
                try {
                    if (dirty) {
                        // Lazy recompute — only runs when accessed AND dirty
                        // effect() runs the wrapper which calls getter() and sets value
                        effect();
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
            stop: () => effect.stop(),
        };

        // The effect runs getter to track dependencies.
        // It's lazy, so it doesn't run until obj.value is accessed.
        const effect = reactiveEffect(
            () => {
                value = getter();
            },
            {
                lazy: true,
                scheduler: () => {
                    if (!dirty) {
                        dirty = true;
                        // Notify anyone watching this computed's value
                        trigger(obj, 'value');
                    }
                },
            },
        );

        return obj;
    } catch (error) {
        logger.error(
            `Computed: Failed to create computed value: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
};

export default computed;
