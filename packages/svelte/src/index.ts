/* --- Store access -------------------------------------------------- */
export {
    useQuanta,
    useQuantaValue,
    useQuantaActions,
    useLocalStore,
} from './store';
export type { SelectorOptions } from './store';

/* --- Containers ---------------------------------------------------- */
export { setQuantaContainer, getQuantaContainer } from './context';
export type { SetQuantaContainerOptions } from './context';

/*
 * --- Re-exports, so a Svelte app imports stores from one place ------
 *
 * Core's reactivity primitives (`reactive`, `computed`, `watch`, …) are left
 * out, as in `@quantajs/vue`: a Svelte app reaches state through stores and
 * runes. Import them from `@quantajs/core` when you need them.
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
