// Core hooks - minimal React integration
export { useQuantaStore } from './hooks/useQuantaStore';
export { useStore } from './hooks/useStore';
export { useCreateStore } from './hooks/useCreateStore';

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

// Re-export core functions
export { createStore, reactive, computed, watch } from '@quantajs/core';