import { describe, it, expectTypeOf } from 'vitest';
import { LitElement } from 'lit';
import {
    createContainer,
    defineStore,
    type StoreContainer,
} from '@quantajs/core';
import {
    QuantaActionsController,
    QuantaController,
    QuantaLocalController,
    QuantaValueController,
    provideQuantaContainer,
    quantaContainerContext,
    type QuantaContainerContext,
} from '../index';

const useCounter = defineStore('lit-type-tests', {
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

class CounterElement extends LitElement {}

describe('Lit public API types', () => {
    it('preserves the selector result of QuantaValueController', () => {
        function assertTypes() {
            const host = new CounterElement();
            const count = new QuantaValueController(
                host,
                useCounter,
                (store) => store.count,
            );
            expectTypeOf(count.value).toEqualTypeOf<number>();

            const label = new QuantaValueController(
                host,
                useCounter,
                (store) => store.label,
            );
            expectTypeOf(label.value).toEqualTypeOf<string>();

            const computed = new QuantaValueController(
                host,
                useCounter,
                (store) => ({ doubled: store.doubled }),
            );
            expectTypeOf(computed.value).toEqualTypeOf<{ doubled: number }>();

            // @ts-expect-error the selector must only read fields on the store
            new QuantaValueController(host, useCounter, (store) => store.missing);
        }

        expectTypeOf(assertTypes).toBeFunction();
    });

    it('preserves the store shape for shared, action-only and local controllers', () => {
        function assertTypes() {
            const host = new CounterElement();
            const shared = new QuantaController(host, useCounter);
            const actions = new QuantaActionsController(host, useCounter);
            const local = new QuantaLocalController(host, useCounter);

            expectTypeOf(shared.store).toEqualTypeOf<CounterStore>();
            expectTypeOf(actions.store).toEqualTypeOf<CounterStore>();
            expectTypeOf(local.store).toEqualTypeOf<CounterStore>();
            expectTypeOf(shared.store.count).toEqualTypeOf<number>();
            expectTypeOf(shared.store.doubled).toEqualTypeOf<number>();
            expectTypeOf(actions.store.increment).toBeFunction();

            // @ts-expect-error the shared controller requires a store definition
            new QuantaController(host, 'counter');
            // @ts-expect-error the actions controller requires a store definition
            new QuantaActionsController(host, 'counter');
            // @ts-expect-error the local controller requires a store definition
            new QuantaLocalController(host, 'counter');
        }

        expectTypeOf(assertTypes).toBeFunction();
    });

    it('types provided containers and the context key', () => {
        function assertTypes() {
            const host = new CounterElement();
            const container = createContainer('lit-types');

            expectTypeOf(container).toEqualTypeOf<StoreContainer>();
            expectTypeOf(
                provideQuantaContainer(host, container),
            ).toEqualTypeOf<StoreContainer>();
            expectTypeOf(provideQuantaContainer(host)).toEqualTypeOf<
                StoreContainer
            >();
            expectTypeOf(quantaContainerContext).toEqualTypeOf<
                QuantaContainerContext
            >();

            // @ts-expect-error the explicit container must implement StoreContainer
            provideQuantaContainer(host, { id: 'invalid' });
            // @ts-expect-error the provider needs an HTMLElement host
            provideQuantaContainer({ addController() {} });
            // @ts-expect-error a plain symbol lacks the container context brand
            const invalid: QuantaContainerContext = Symbol('invalid');
            expectTypeOf(invalid).toEqualTypeOf<QuantaContainerContext>();
        }

        expectTypeOf(assertTypes).toBeFunction();
    });
});
