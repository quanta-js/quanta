// Core hooks
export { useQuantaStore } from './hooks/useQuantaStore';
export { useStore } from './hooks/useStore';
export { useCreateStore } from './hooks/useCreateStore';
export { useComputed } from './hooks/useComputed';
export { useWatch } from './hooks/useWatch';

// Components
export { QuantaProvider } from './components/QuantaProvider';

// Context
export { QuantaContext, useQuantaContext } from './context/QuantaContext';

// Re-export core types for convenience
export type {
    StateDefinition,
    GetterDefinition,
    ActionDefinition,
    Store,
    StoreInstance,
    StoreSubscriber,
} from '@quantajs/core';

// Re-export core functions that might be useful
export { createStore, reactive, computed, watch } from '@quantajs/core';
