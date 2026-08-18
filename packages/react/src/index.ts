'use client';

/* --- Store access -------------------------------------------------- */
export { useQuanta, useQuantaValue, useQuantaActions } from './hooks/useStore';
export { useLocalStore } from './hooks/useCreateStore';

/* --- Lower-level hooks (take a resolved store, not a definition) ---- */
export {
    useQuantaStore,
    useQuantaSelector,
    shallow,
} from './hooks/useQuantaStore';
export type { EqualityFn, SelectorOptions } from './hooks/useQuantaStore';
export { useWatch } from './hooks/useWatch';
export { useComputed } from './hooks/useComputed';

/* --- Components ----------------------------------------------------- */
export { QuantaProvider } from './components/QuantaProvider';
export type { QuantaProviderProps } from './components/QuantaProvider';
/**
 * Deprecated placeholder. The real panel is at `@quantajs/react/devtools`; see
 * `QuantaDevToolsStub` for why it cannot live here.
 */
export { QuantaDevTools } from './components/QuantaDevToolsStub';
export type { QuantaDevToolsProps } from './components/devtools-types';

/* --- Context -------------------------------------------------------- */
export {
    QuantaContext,
    useQuantaContext,
    useContainerOrDefault,
} from './context/QuantaContext';
export type { QuantaContextValue } from './context/QuantaContext';

/* --- Re-exports, so a React app imports from one place -------------- */
export {
    defineStore,
    createStore,
    createContainer,
    getDefaultContainer,
    setDefaultContainer,
    resetDefaultContainer,
    destroyAllStores,
    reactive,
    shallowReactive,
    readonly,
    computed,
    watch,
    effect,
    effectScope,
    batchEffects,
    untrack,
    nextTick,
    toRaw,
    markRaw,
    isReactive,
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
    ComputedRef,
} from '@quantajs/core';
