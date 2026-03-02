import { describe, it, expectTypeOf } from 'vitest';
import type {
    StateDefinition,
    RawActions,
    StoreInstance,
    StoreSubscriber,
} from '../type/store-types';
import type {
    PersistenceAdapter,
    PersistedData,
    PersistenceManager,
} from '../type/persistence-types';
import { reactive, computed } from '../state';
import { LogLevel } from '../services/logger-service';

describe('type-level tests', () => {
    describe('StateDefinition', () => {
        it('should accept a function returning an object', () => {
            type SD = StateDefinition<{ count: number }>;
            expectTypeOf<SD>().toEqualTypeOf<() => { count: number }>();
        });
    });

    describe('StoreSubscriber', () => {
        it('should accept optional snapshot parameter', () => {
            type Sub = StoreSubscriber<{ count: number }>;
            expectTypeOf<Sub>().toBeFunction();
        });
    });

    describe('RawActions', () => {
        it('should be a record of functions', () => {
            expectTypeOf<RawActions>().toEqualTypeOf<
                Record<string, (...args: any[]) => any>
            >();
        });
    });

    describe('PersistenceAdapter', () => {
        it('should have required methods', () => {
            expectTypeOf<PersistenceAdapter>().toHaveProperty('key');
            expectTypeOf<PersistenceAdapter>().toHaveProperty('read');
            expectTypeOf<PersistenceAdapter>().toHaveProperty('write');
            expectTypeOf<PersistenceAdapter>().toHaveProperty('remove');
        });
    });

    describe('PersistenceManager', () => {
        it('should have required methods', () => {
            expectTypeOf<PersistenceManager>().toHaveProperty('save');
            expectTypeOf<PersistenceManager>().toHaveProperty('load');
            expectTypeOf<PersistenceManager>().toHaveProperty('clear');
            expectTypeOf<PersistenceManager>().toHaveProperty('getAdapter');
            expectTypeOf<PersistenceManager>().toHaveProperty('isRehydrated');
            expectTypeOf<PersistenceManager>().toHaveProperty('destroy');
        });
    });

    describe('PersistedData', () => {
        it('should contain data, version, timestamp', () => {
            expectTypeOf<PersistedData>().toHaveProperty('data');
            expectTypeOf<PersistedData>().toHaveProperty('version');
            expectTypeOf<PersistedData>().toHaveProperty('timestamp');
        });
    });

    describe('LogLevel enum', () => {
        it('should have correct numeric values', () => {
            expectTypeOf(LogLevel.DEBUG).toBeNumber();
            expectTypeOf(LogLevel.INFO).toBeNumber();
            expectTypeOf(LogLevel.WARN).toBeNumber();
            expectTypeOf(LogLevel.ERROR).toBeNumber();
            expectTypeOf(LogLevel.SILENT).toBeNumber();
        });
    });

    describe('reactive function types', () => {
        it('should return same type as input', () => {
            const state = reactive({ count: 0, name: 'test' });
            expectTypeOf(state).toEqualTypeOf<{
                count: number;
                name: string;
            }>();
        });
    });

    describe('computed function types', () => {
        it('should return object with value property', () => {
            const comp = computed(() => 42);
            expectTypeOf(comp).toHaveProperty('value');
            expectTypeOf(comp.value).toBeNumber();
        });
    });

    describe('StoreInstance type', () => {
        it('should expose state, getters, actions, subscribe, $reset', () => {
            type Instance = StoreInstance<
                { count: number },
                { doubled: (s: { count: number }) => number },
                { increment: () => void }
            >;

            expectTypeOf<Instance>().toHaveProperty('state');
            expectTypeOf<Instance>().toHaveProperty('getters');
            expectTypeOf<Instance>().toHaveProperty('actions');
            expectTypeOf<Instance>().toHaveProperty('subscribe');
            expectTypeOf<Instance>().toHaveProperty('$reset');
        });
    });
});
