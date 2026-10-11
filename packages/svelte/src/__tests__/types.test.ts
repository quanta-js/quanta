import { describe, it, expectTypeOf } from 'vitest';
import type { Readable } from 'svelte/store';
import { createContainer, defineStore, type StoreContainer } from '@quantajs/core';
import {
    getQuantaContainer,
    setQuantaContainer,
    useLocalStore,
    useQuanta,
    useQuantaActions,
    useQuantaValue,
} from '../index';

const useCounter = defineStore('svelte-type-tests', {
    state: () => ({ count: 0, label: 'ready' }),
    getters: {
        doubled: (state) => state.count * 2,
    },
    actions: {
        increment() {
            this.count += 1;
        },
    },
});

type CounterStore = ReturnType<typeof useCounter>;

describe('Svelte public API types', () => {
    it('preserves the selected value type in a readable store', () => {
        // These calls are checked by TypeScript without requiring a Svelte component at runtime.
        function assertTypes() {
            const count = useQuantaValue(useCounter, (store) => store.count);
            expectTypeOf(count).toEqualTypeOf<Readable<number>>();

            const label = useQuantaValue(useCounter, (store) => store.label);
            expectTypeOf(label).toEqualTypeOf<Readable<string>>();

            const doubled = useQuantaValue(useCounter, (store) => store.doubled);
            expectTypeOf(doubled).toEqualTypeOf<Readable<number>>();

            // @ts-expect-error selectors must only access keys exposed by the store
            useQuantaValue(useCounter, (store) => store.missing);

            // @ts-expect-error equality callbacks must use the selected value type
            useQuantaValue(useCounter, (store) => store.count, {
                equalityFn: (a: string, b: string) => a === b,
            });
        }

        expectTypeOf(assertTypes).toBeFunction();
    });

    it('preserves the store shape for readable and actions-only bindings', () => {
        function assertTypes() {
            const shared = useQuanta(useCounter);
            expectTypeOf(shared).toEqualTypeOf<Readable<CounterStore>>();

            const local = useLocalStore(useCounter);
            expectTypeOf(local).toEqualTypeOf<Readable<CounterStore>>();

            const actions = useQuantaActions(useCounter);
            expectTypeOf(actions).toEqualTypeOf<CounterStore>();
            expectTypeOf(actions.count).toEqualTypeOf<number>();
            expectTypeOf(actions.doubled).toEqualTypeOf<number>();

            // @ts-expect-error a store definition is required
            useQuanta('counter');

            // @ts-expect-error a store definition is required
            useLocalStore('counter');

            // @ts-expect-error a store definition is required
            useQuantaActions('counter');
        }

        expectTypeOf(assertTypes).toBeFunction();
    });

    it('types context helpers with StoreContainer', () => {
        function assertTypes() {
            const container = createContainer('svelte-types');
            expectTypeOf(container).toEqualTypeOf<StoreContainer>();
            expectTypeOf(setQuantaContainer(container)).toEqualTypeOf<StoreContainer>();
            expectTypeOf(setQuantaContainer()).toEqualTypeOf<StoreContainer>();
            expectTypeOf(getQuantaContainer()).toEqualTypeOf<StoreContainer | undefined>();

            // @ts-expect-error the container must implement StoreContainer
            setQuantaContainer({ id: 'invalid' });

            // @ts-expect-error the context getter does not take arguments
            getQuantaContainer(container);
        }

        expectTypeOf(assertTypes).toBeFunction();
    });
});
