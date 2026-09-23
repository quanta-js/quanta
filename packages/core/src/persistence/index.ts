// Core persistence functionality
export { createPersistenceManager } from './core';
export {
    MigrationManager,
    createMigrationManager,
    CommonMigrations,
} from './migrations';

// Types
export type {
    PersistenceAdapter,
    PersistenceConfig,
    PersistedData,
    PersistenceManager,
} from '../type/persistence-types';

// Adapters
export {
    LocalStorageAdapter,
    SessionStorageAdapter,
    IndexedDBAdapter,
    CookieAdapter,
} from './adapters';
export type { CookieAdapterOptions } from './adapters';
