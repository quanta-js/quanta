/* --- Controllers --------------------------------------------------- */
export {
    QuantaController,
    QuantaValueController,
    QuantaActionsController,
    QuantaLocalController,
} from './controllers';
export type { ControllerOptions, QuantaValueOptions } from './controllers';

/* --- Containers ---------------------------------------------------- */
export {
    provideQuantaContainer,
    requestQuantaContainer,
    quantaContainerContext,
} from './context';
export type { QuantaContainerContext } from './context';

/*
 * --- Re-exports, so an app imports stores from one place -----------
 *
 * The same set as `@quantajs/vue` and `@quantajs/svelte`. Core's reactivity
 * primitives (`reactive`, `computed`, `watch`) come from `@quantajs/core`.
 */
export {
    defineStore,
    createStore,
    createContainer,
    getDefaultContainer,
    setDefaultContainer,
    resetDefaultContainer,
    destroyAllStores,
    batchEffects,
    shallow,
    enableDevTools,
    disableDevTools,
    logger,
} from '@quantajs/core';

export type {
    StateTree,
    GettersTree,
    ActionsTree,
    ActionState,
    Store,
    AnyStore,
    StoreApi,
    StoreDefinition,
    StoreDefinitionOptions,
    StoreContainer,
    ContainerSnapshot,
    StoreSubscriber,
} from '@quantajs/core';
