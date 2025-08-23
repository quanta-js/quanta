import { createReactive } from '../core/create-reactive';
import { logger } from '../services/logger-service';

const reactive = <S>(target: S): S => {
    try {
        const reactiveObject = createReactive(target) as S;
        return reactiveObject;
    } catch (error) {
        logger.error(
            `Reactive: Failed to create reactive object: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
};

export default reactive;
