/* ------------------------------------------------------------------ *
 * Reactive state
 * ------------------------------------------------------------------ */
export {
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly,
    computed,
    watch,
    isReactive,
    isReadonly,
    isProxy,
    toRaw,
    markRaw,
} from './state';

export type { ComputedRef } from './state/computed';
export type { WatchOptions, WatchStopHandle } from './state/watch';

/* ------------------------------------------------------------------ *
 * Effects
 * ------------------------------------------------------------------ */
export {
    effect,
    reactiveEffect,
    effectScope,
    batchEffects,
    untrack,
    nextTick,
    pauseTracking,
    resumeTracking,
} from './core/effect';

export type { EffectRunner, EffectOptions, EffectScope } from './core/effect';

/* ------------------------------------------------------------------ *
 * Stores
 * ------------------------------------------------------------------ */
export {
    defineStore,
    createStore,
    useStore,
    hasStore,
    destroyAllStores,
    createContainer,
    getDefaultContainer,
    setDefaultContainer,
    resetDefaultContainer,
} from './core';

export type {
    StoreDefinition,
    StoreContainer,
    ContainerSnapshot,
} from './core';

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */
export * from './persistence';

/* ------------------------------------------------------------------ *
 * DevTools (opt-in — see the security note in devtools/index.ts)
 * ------------------------------------------------------------------ */
export { enableDevTools, disableDevTools, devtools } from './devtools';
export type { DevToolsEvent, DevToolsOptions } from './devtools';

/* ------------------------------------------------------------------ *
 * Utilities
 * ------------------------------------------------------------------ */
export {
    logger,
    Logger,
    LogLevel,
    createLogger,
} from './services/logger-service';

export { debounce } from './utils/debounce';
export {
    sanitizePayload,
    safeJsonParse,
    safeJsonReviver,
} from './utils/sanitize';

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */
export type {
    // Current
    StateTree,
    StateDefinition,
    GettersTree,
    ActionsTree,
    ActionState,
    BoundAction,
    BoundActions,
    UnwrapGetters,
    Store,
    AnyStore,
    StoreApi,
    StoreDefinitionOptions,
    StoreSubscriber,
    // Deprecated aliases, kept so existing imports keep resolving
    RawActions,
    GetterDefinitions,
    ActionDefinition,
    InferActions,
    StoreInstance,
    StoreOptions,
} from './type/store-types';
