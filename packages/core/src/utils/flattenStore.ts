import {
    RawActions,
    StoreInstance,
    StoreSubscriber,
} from '../type/store-types';
import { logger } from '../services/logger-service';
import { trigger } from '../core/effect';

export const flattenStore = <
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
>(store: {
    state: S;
    getters: { [K in keyof GDefs]: { value: ReturnType<GDefs[K]> } };
    actions: A;
    subscribe?: (cb: StoreSubscriber) => () => void;
    notifyAll?: () => void;
    $reset: () => void;
    $destroy: () => void;
}): StoreInstance<S, GDefs, A> => {
    try {
        const flattenedProxy = new Proxy(store, {
            get(target, prop: string, receiver) {
                try {
                    // Check in state
                    if (prop in target.state) {
                        return Reflect.get(target.state, prop);
                    }

                    // Check in getters (return the computed value)
                    if (prop in target.getters) {
                        const getter: any = Reflect.get(target.getters, prop);
                        try {
                            // handle computed objects that expose `.value`
                            if (
                                getter &&
                                typeof getter === 'object' &&
                                'value' in getter
                            ) {
                                return getter.value;
                            }
                            if (typeof getter === 'function') {
                                // call/bind? we return function – keep binding to flattened store
                                return getter.bind(flattenedProxy);
                            }
                            return getter;
                        } catch (err) {
                            logger.warn(
                                `FlattenStore: getter read failed for "${String(prop)}": ${String(err)}`,
                            );
                            return getter;
                        }
                    }

                    // Check in actions
                    if (prop in target.actions) {
                        return Reflect.get(target.actions, prop);
                    }

                    // Fallback to the original target (e.g. store.state, store.getters, etc.)
                    return Reflect.get(target, prop, receiver);
                } catch (error) {
                    logger.error(
                        `FlattenStore: Failed to get property "${prop}": ${error instanceof Error ? error.message : String(error)}`,
                    );
                    throw error;
                }
            },
            set(target, prop: string, value, receiver) {
                try {
                    const wasInState = prop in target.state;
                    const result = wasInState
                        ? Reflect.set(target.state, prop, value) // Mutate reactive state
                        : Reflect.set(target, prop, value, receiver); // Fallback
                    if (result && wasInState) {
                        // Trigger core reactivity (per-key)
                        trigger(target.state, prop);
                        // Broad notify via notifyAll (global subs for frameworks)
                        target.notifyAll?.();
                    }
                    const resultFallback = Reflect.set(
                        target,
                        prop,
                        value,
                        receiver,
                    );
                    target.notifyAll?.();
                    return resultFallback;
                } catch (error) {
                    logger.error(
                        `FlattenStore: Failed to set property "${prop}": ${error instanceof Error ? error.message : String(error)}`,
                    );
                    throw error;
                }
            },
        });

        return flattenedProxy as unknown as StoreInstance<S, GDefs, A>;
    } catch (error) {
        logger.error(
            `FlattenStore: Failed to create flattened store: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
};
