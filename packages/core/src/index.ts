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

export { shallow } from './utils/shallow';

export type { ComputedRef } from './state/computed';
export type { WatchOptions, WatchStopHandle } from './state/watch';

/* ------------------------------------------------------------------ *
 * Effects
 * ------------------------------------------------------------------ */
export { effect, effectScope, batchEffects, untrack } from './core/effect';

export type { EffectRunner, EffectOptions, EffectScope } from './core/effect';

/* ------------------------------------------------------------------ *
 * Stores
 * ------------------------------------------------------------------ */
export {
    defineStore,
    createStore,
    destroyAllStores,
    createContainer,
    getDefaultContainer,
    setDefaultContainer,
    setDefaultContainerResolver,
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
export { logger, LogLevel } from './services/logger-service';

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */
export type {
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
} from './type/store-types';
