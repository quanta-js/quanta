import { describe, it, expectTypeOf } from 'vitest';
import type {
    StateDefinition,
    ActionsTree,
    Store,
    StoreSubscriber,
} from '../type/store-types';
import type {
    PersistenceAdapter,
    PersistenceConfig,
    PersistedData,
    PersistenceManager,
    StoredState,
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

    describe('ActionsTree', () => {
        it('should be a record of functions', () => {
            expectTypeOf<ActionsTree>().toEqualTypeOf<
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

    describe('PersistenceConfig', () => {
        type State = { theme: string; token: string; opened: Date };
        type Config = PersistenceConfig<State>;
        const adapter = {} as PersistenceAdapter;

        it('limits include and exclude to state keys', () => {
            const config: Config = { adapter, include: ['theme'] };
            expectTypeOf(config).toMatchTypeOf<Config>();
            // @ts-expect-error not a key of the state
            const wrong: Config = { adapter, include: ['nope'] };
            expectTypeOf(wrong).toMatchTypeOf<Config>();
        });

        it('passes the envelope to serialize', () => {
            expectTypeOf<
                Parameters<NonNullable<Config['serialize']>>[0]
            >().toEqualTypeOf<PersistedData>();
        });

        it('types transform.out by the state and the rest as stored data', () => {
            type Transform = NonNullable<Config['transform']>;
            expectTypeOf<
                Parameters<NonNullable<Transform['out']>>[0]
            >().toEqualTypeOf<Partial<State>>();
            expectTypeOf<
                Parameters<NonNullable<Transform['in']>>[0]
            >().toEqualTypeOf<StoredState>();
            expectTypeOf<
                Parameters<NonNullable<Config['validator']>>[0]
            >().toEqualTypeOf<StoredState>();
        });

        it('has adapters exchange strings', () => {
            expectTypeOf<
                ReturnType<PersistenceAdapter['read']>
            >().toEqualTypeOf<string | null | Promise<string | null>>();
            expectTypeOf<
                Parameters<PersistenceAdapter['write']>[0]
            >().toEqualTypeOf<string>();
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

    describe('Store type', () => {
        it('should expose state, getters, actions, subscribe, $reset', () => {
            type Instance = Store<
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
