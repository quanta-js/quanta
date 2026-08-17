'use client';

/* Hooks */
export {
    useQuantaStore,
    useQuantaSelector,
    shallow,
} from './hooks/useQuantaStore';
export type { EqualityFn, SelectorOptions } from './hooks/useQuantaStore';
export { useStore, useStoreSelector } from './hooks/useStore';
export { useCreateStore } from './hooks/useCreateStore';
export { useWatch } from './hooks/useWatch';
export { useComputed } from './hooks/useComputed';

/* Components */
export { QuantaProvider } from './components/QuantaProvider';
export type { QuantaProviderProps } from './components/QuantaProvider';
export { QuantaDevTools } from './components/QuantaDevTools';
export type { QuantaDevToolsProps } from './components/QuantaDevTools';

/* Context */
export { QuantaContext, useQuantaContext } from './context/QuantaContext';
export type { QuantaContextValue } from './context/QuantaContext';

/* Re-exports so a React app can import everything from one place */
export {
    createStore,
    getOrCreateStore,
    useStore as getStore,
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
    StateDefinition,
    GetterDefinitions,
    ActionDefinition,
    StoreInstance,
    StoreSubscriber,
    StoreOptions,
    RawActions,
    ComputedRef,
} from '@quantajs/core';
