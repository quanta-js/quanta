/**
 * @vitest-environment happy-dom
 *
 * Runs against Svelte 5 and, in CI's compatibility job, Svelte 4, so the
 * fixtures use syntax both accept and components are mounted with whichever
 * API the installed version has.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import * as svelte from 'svelte';
import { tick } from 'svelte';
import { get, type Readable } from 'svelte/store';
import {
    createContainer,
    defineStore,
    destroyAllStores,
    resetDefaultContainer,
    shallow,
    type StoreContainer,
} from '@quantajs/core';
import {
    getQuantaContainer,
    useQuanta,
    useQuantaActions,
    useQuantaValue,
} from '../index';
import Counter from './fixtures/Counter.svelte';
import Scope from './fixtures/Scope.svelte';
import TwoLocal from './fixtures/TwoLocal.svelte';

let uid = 0;
const name = (p = 'svelte') => `${p}_${++uid}`;

const defineCounter = () =>
    defineStore(name('counter'), {
        state: () => ({ a: 0, b: 0, items: [] as number[] }),
        getters: {
            total: (s) => s.a + s.b,
        },
        actions: {
            incA() {
                this.a++;
            },
        },
    });

type CounterStore = ReturnType<ReturnType<typeof defineCounter>>;

async function render(
    component: typeof Counter,
    props: Record<string, unknown>,
) {
    const target = document.createElement('div');
    let destroy: () => void;
    if ('mount' in svelte && typeof svelte.mount === 'function') {
        const instance = svelte.mount(component, { target, props });
        destroy = () => svelte.unmount(instance);
    } else {
        // Svelte 4: components are classes.
        const Legacy = component as unknown as new (options: object) => {
            $destroy(): void;
        };
        const instance = new Legacy({ target, props });
        destroy = () => instance.$destroy();
    }
    await tick();
    return { target, destroy };
}

/** Collect every value a Svelte store emits until unsubscribed. */
function record<T>(store: Readable<T>) {
    const values: T[] = [];
    const stop = store.subscribe((value) => values.push(value));
    return { values, stop };
}

afterEach(() => {
    destroyAllStores();
    resetDefaultContainer();
});

describe('useQuantaValue', () => {
    it('emits the current value, then each change', () => {
        const useCounter = defineCounter();
        const { values, stop } = record(useQuantaValue(useCounter, (s) => s.a));

        useCounter().incA();
        useCounter().b++;
        stop();

        expect(values).toEqual([0, 1]);
    });

    it('emits when a selected object is mutated in place', () => {
        const useCounter = defineCounter();
        const lengths: number[] = [];
        const stop = useQuantaValue(useCounter, (s) => s.items).subscribe(
            (items) => lengths.push(items.length),
        );

        useCounter().items.push(1);
        stop();

        expect(lengths).toEqual([0, 1]);
    });

    it('skips values the equality function calls equal', () => {
        const useCounter = defineCounter();
        const { values, stop } = record(
            useQuantaValue(useCounter, (s) => ({ even: s.a % 2 === 0 }), {
                equalityFn: shallow,
            }),
        );

        useCounter().a = 2;
        useCounter().a = 3;
        stop();

        expect(values).toEqual([{ even: true }, { even: false }]);
    });

    it('tracks the store only while subscribed', () => {
        const useCounter = defineCounter();
        const selector = vi.fn((s: CounterStore) => s.a);
        const value = useQuantaValue(useCounter, selector);
        selector.mockClear();

        useCounter().incA();
        expect(selector).not.toHaveBeenCalled();

        const { values, stop } = record(value);
        stop();
        selector.mockClear();
        useCounter().incA();

        expect(values).toEqual([1]);
        expect(selector).not.toHaveBeenCalled();
    });
});

describe('useQuanta', () => {
    it('emits the store on every change', () => {
        const useCounter = defineCounter();
        const { values, stop } = record(useQuanta(useCounter));

        useQuantaActions(useCounter).incA();
        stop();

        expect(values).toHaveLength(2);
        expect(values[1].a).toBe(1);
    });

    it('renders and updates in a component', async () => {
        const useCounter = defineCounter();
        const { target } = await render(Counter, { definition: useCounter });
        expect(target.textContent).toBe('0/0');

        useCounter().incA();
        await tick();
        expect(target.textContent).toBe('1/1');
    });
});

describe('setQuantaContainer', () => {
    it('scopes descendants to a container and hydrates a snapshot', async () => {
        const useCounter = defineCounter();
        const server = createContainer('server');
        useCounter(server).a = 4;
        const snapshot = server.dehydrate();
        server.dispose();

        const { target } = await render(Scope, {
            definition: useCounter,
            snapshot,
        });

        expect(target.textContent).toBe('4/4');
        expect(useCounter().a).toBe(0);
    });

    it('disposes only a container it created, when destroyed', async () => {
        const useCounter = defineCounter();
        let owned!: StoreContainer;
        const supplied = createContainer('mine');

        const first = await render(Scope, {
            definition: useCounter,
            onContainer: (c: StoreContainer) => (owned = c),
        });
        first.destroy();
        const second = await render(Scope, {
            definition: useCounter,
            container: supplied,
        });
        second.destroy();

        expect(owned.active).toBe(false);
        expect(supplied.active).toBe(true);
    });

    it('falls back to the default container outside a component', () => {
        expect(getQuantaContainer()).toBeUndefined();
    });
});

describe('useLocalStore', () => {
    it('gives each instance its own store, disposed with the component', async () => {
        const useCounter = defineCounter();
        const stores: CounterStore[] = [];
        const { target, destroy } = await render(TwoLocal, {
            definition: useCounter,
            onStore: (store: Readable<CounterStore>) => stores.push(get(store)),
        });

        stores[0].incA();
        await tick();
        expect(target.textContent).toBe('10');

        const listener = vi.fn();
        stores[1].subscribe(listener);
        destroy();
        stores[1].incA();
        expect(listener).not.toHaveBeenCalled();
    });
});
