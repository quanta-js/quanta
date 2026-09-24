/* --- Store access -------------------------------------------------- */
export {
    useQuanta,
    useQuantaValue,
    useQuantaActions,
    useLocalStore,
} from './store';
export type { SelectorOptions } from './store';

/* --- Containers ---------------------------------------------------- */
export {
    createQuanta,
    provideQuantaContainer,
    useQuantaContainer,
} from './container';
export type { QuantaPlugin, QuantaPluginOptions } from './container';

/*
 * --- Re-exports, so a Vue app imports stores from one place ---------
 *
 * Core's reactivity primitives (`reactive`, `computed`, `watch`, …) are left
 * out: Vue exports functions with the same names, and the two must not be
 * confused. Import those from `@quantajs/core` when you need them.
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
