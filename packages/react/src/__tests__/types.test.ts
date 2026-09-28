import { describe, it, expectTypeOf } from 'vitest';
import {
    QuantaProvider,
    createContainer,
    defineStore,
    useLocalStore,
    useQuanta,
    useQuantaActions,
    useQuantaValue,
    type Store,
} from '../index';

const useCounterStore = defineStore('react-type-counter', {
    state: () => ({
        count: 0,
        label: 'counter',
    }),
    getters: {
        doubled: (state) => state.count * 2,
    },
    actions: {
        increment(by: number) {
            this.count += by;
            return this.count;
        },
        rename(label: string) {
            this.label = label;
        },
    },
});

type CounterStore = Store<
    { count: number; label: string },
    { doubled: (state: { count: number; label: string }) => number },
    {
        increment: (by: number) => number;
        rename: (label: string) => void;
    }
>;

describe('React type-level tests', () => {
    describe('useQuantaValue', () => {
        it('returns the selector result and types equalityFn against it', () => {
            const _selectedCount = () =>
                useQuantaValue(useCounterStore, (store) => store.count, {
                    equalityFn: (previous, next) => previous === next,
                });

            expectTypeOf<
                ReturnType<typeof _selectedCount>
            >().toEqualTypeOf<number>();

            const _selectedLabel = () =>
                useQuantaValue(useCounterStore, (store) => store.label);

            const _invalidEquality = () =>
                useQuantaValue(
                    useCounterStore,
                    // @ts-expect-error equalityFn parameters must match the selector result
                    (store) => store.label,
                    {
                        equalityFn: (previous: number, next: number) =>
                            previous === next,
                    },
                );

            expectTypeOf<
                ReturnType<typeof _selectedLabel>
            >().toEqualTypeOf<string>();
            expectTypeOf<
                ReturnType<typeof _invalidEquality>
            >().toEqualTypeOf<number>();
        });
    });

    describe('useQuanta', () => {
        it('returns the inferred store shape', () => {
            const _resolvedStore = () => useQuanta(useCounterStore);

            expectTypeOf<
                ReturnType<typeof _resolvedStore>
            >().toEqualTypeOf<CounterStore>();
            expectTypeOf<
                ReturnType<typeof _resolvedStore>['state']
            >().toEqualTypeOf<{
                count: number;
                label: string;
            }>();
            expectTypeOf<
                ReturnType<typeof _resolvedStore>['doubled']
            >().toEqualTypeOf<number>();

            const _invalidStore = () =>
                // @ts-expect-error useQuanta expects a store definition
                useQuanta({ count: 0 });

            expectTypeOf<typeof _invalidStore>().toBeFunction();
        });
    });

    describe('useLocalStore', () => {
        it('returns a local store with state, getters and actions', () => {
            const _localStore = () => useLocalStore(useCounterStore);

            expectTypeOf<
                ReturnType<typeof _localStore>
            >().toEqualTypeOf<CounterStore>();
            expectTypeOf<
                ReturnType<typeof _localStore>['increment']
            >().parameters.toEqualTypeOf<[number]>();
            expectTypeOf<
                ReturnType<typeof _localStore>['rename']
            >().returns.toEqualTypeOf<void>();

            const _invalidLocalStore = () =>
                // @ts-expect-error useLocalStore expects a store definition
                useLocalStore(useCounterStore());

            expectTypeOf<typeof _invalidLocalStore>().toBeFunction();
        });
    });

    describe('useQuantaActions', () => {
        it('exposes actions with their parameter types', () => {
            const _actionStore = () => useQuantaActions(useCounterStore);

            expectTypeOf<
                ReturnType<typeof _actionStore>['increment']
            >().parameters.toEqualTypeOf<[number]>();
            expectTypeOf<
                ReturnType<typeof _actionStore>['increment']
            >().returns.toEqualTypeOf<number>();
            expectTypeOf<
                ReturnType<typeof _actionStore>['rename']
            >().parameters.toEqualTypeOf<[string]>();

            const _invalidActionCall = () => {
                const store = useQuantaActions(useCounterStore);
                // @ts-expect-error increment requires a number argument
                return store.increment('1');
            };

            expectTypeOf<
                ReturnType<typeof _invalidActionCall>
            >().toEqualTypeOf<number>();
        });
    });

    describe('QuantaProvider', () => {
        it('accepts an optional container', () => {
            const _renderWithContainer = () =>
                QuantaProvider({
                    container: createContainer('react-type-container'),
                    children: null,
                });
            const _renderWithoutContainer = () =>
                QuantaProvider({ children: null });

            expectTypeOf<
                Parameters<typeof QuantaProvider>[0]['container']
            >().toEqualTypeOf<ReturnType<typeof createContainer> | undefined>();
            expectTypeOf<
                ReturnType<typeof _renderWithContainer>
            >().toEqualTypeOf<ReturnType<typeof _renderWithoutContainer>>();

            const _invalidProvider = () =>
                QuantaProvider({
                    // @ts-expect-error container must be a StoreContainer
                    container: { active: true },
                    children: null,
                });

            expectTypeOf<ReturnType<typeof _invalidProvider>>().toEqualTypeOf<
                ReturnType<typeof QuantaProvider>
            >();
        });
    });
});
