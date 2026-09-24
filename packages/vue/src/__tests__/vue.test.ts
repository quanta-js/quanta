/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
    createApp,
    createSSRApp,
    defineComponent,
    effectScope,
    h,
    isReactive,
    nextTick,
    onUpdated,
    reactive,
    type App,
    type Component,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import {
    createContainer,
    defineStore,
    destroyAllStores,
    resetDefaultContainer,
    shallow,
} from '@quantajs/core';
import {
    createQuanta,
    provideQuantaContainer,
    useLocalStore,
    useQuanta,
    useQuantaActions,
    useQuantaValue,
    type QuantaPlugin,
} from '../index';

let uid = 0;
const name = (p = 'vue') => `${p}_${++uid}`;

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
            incB() {
                this.b++;
            },
        },
    });

function mount(component: Component, plugin?: QuantaPlugin) {
    const el = document.createElement('div');
    const app = createApp(component);
    if (plugin) app.use(plugin);
    app.mount(el);
    return { el, app };
}

/** A component that renders `render()` and counts its re-renders. */
function counted(render: () => string, setup: () => void = () => {}) {
    const renders = { count: 0 };
    const component = defineComponent({
        setup() {
            setup();
            onUpdated(() => {
                renders.count++;
            });
            return () => h('span', render());
        },
    });
    return { component, renders };
}

afterEach(() => {
    destroyAllStores();
    resetDefaultContainer();
    vi.unstubAllGlobals();
});

describe('useQuanta', () => {
    it('re-renders on a change and reads getters', async () => {
        const useCounter = defineCounter();
        let store!: ReturnType<typeof useCounter>;
        const { el } = mount(
            defineComponent({
                setup() {
                    store = useQuanta(useCounter);
                    return () => h('span', `${store.a}/${store.total}`);
                },
            }),
        );
        expect(el.textContent).toBe('0/0');

        store.incA();
        await nextTick();
        expect(el.textContent).toBe('1/1');
    });

    it('is never wrapped in Vue reactivity', () => {
        const useCounter = defineCounter();
        effectScope().run(() => {
            const store = useQuanta(useCounter);
            expect(reactive(store)).toBe(store);
            expect(isReactive(store)).toBe(false);
        });
    });

    it('stops re-rendering after unmount', async () => {
        const useCounter = defineCounter();
        const { component, renders } = counted(() => {
            const store = useQuanta(useCounter);
            return String(store.a);
        });
        const { app } = mount(component);
        app.unmount();

        useCounter().incA();
        await nextTick();
        expect(renders.count).toBe(0);
    });
});

describe('useQuantaValue', () => {
    it('updates only the components whose selection changed', async () => {
        const useCounter = defineCounter();
        let a!: { value: number };
        let b!: { value: number };
        const first = counted(
            () => String(a.value),
            () => {
                a = useQuantaValue(useCounter, (s) => s.a);
            },
        );
        const second = counted(
            () => String(b.value),
            () => {
                b = useQuantaValue(useCounter, (s) => s.b);
            },
        );
        const one = mount(first.component);
        const two = mount(second.component);

        useQuantaActions(useCounter).incA();
        await nextTick();

        expect(one.el.textContent).toBe('1');
        expect(first.renders.count).toBe(1);
        expect(second.renders.count).toBe(0);
        expect(two.el.textContent).toBe('0');
    });

    it('updates when a selected object is mutated in place', async () => {
        const useCounter = defineCounter();
        let items!: { value: number[] };
        const { component } = counted(
            () => String(items.value.length),
            () => {
                items = useQuantaValue(useCounter, (s) => s.items);
            },
        );
        const { el } = mount(component);

        useCounter().items.push(1);
        await nextTick();
        expect(el.textContent).toBe('1');
    });

    it('skips updates the equality function calls equal', async () => {
        const useCounter = defineCounter();
        let parity!: { value: { even: boolean } };
        const { component, renders } = counted(
            () => String(parity.value.even),
            () => {
                parity = useQuantaValue(
                    useCounter,
                    (s) => ({ even: s.a % 2 === 0 }),
                    { equalityFn: shallow },
                );
            },
        );
        mount(component);

        const store = useCounter();
        store.a = 2;
        await nextTick();
        expect(renders.count).toBe(0);

        store.a = 3;
        await nextTick();
        expect(renders.count).toBe(1);
    });

    it('reads once and does not subscribe on the server', () => {
        const useCounter = defineCounter();
        vi.stubGlobal('window', undefined);
        effectScope().run(() => {
            const a = useQuantaValue(useCounter, (s) => s.a);
            useCounter().incA();
            expect(a.value).toBe(0);
        });
    });
});

describe('createQuanta', () => {
    it('gives each app its own container', async () => {
        const useCounter = defineCounter();
        const view = () =>
            defineComponent({
                setup() {
                    const store = useQuanta(useCounter);
                    return () => h('span', String(store.a));
                },
            });
        const first = createQuanta();
        const second = createQuanta();
        const one = mount(view(), first);
        const two = mount(view(), second);

        useCounter(first.container).incA();
        await nextTick();

        expect(one.el.textContent).toBe('1');
        expect(two.el.textContent).toBe('0');
    });

    it('hydrates from a server snapshot before the first render', () => {
        const useCounter = defineCounter();
        const server = createContainer('server');
        useCounter(server).a = 5;
        const snapshot = server.dehydrate();
        server.dispose();

        const { el } = mount(
            defineComponent({
                setup() {
                    const a = useQuantaValue(useCounter, (s) => s.a);
                    return () => h('span', String(a.value));
                },
            }),
            createQuanta({ snapshot }),
        );
        expect(el.textContent).toBe('5');
    });

    it('disposes only a container it created, when the app unmounts', () => {
        const owned = createQuanta();
        const supplied = createQuanta({ container: createContainer('mine') });
        const empty = defineComponent({ render: () => null });

        mount(empty, owned).app.unmount();
        mount(empty, supplied).app.unmount();

        expect(owned.container.active).toBe(false);
        expect(supplied.container.active).toBe(true);
    });

    it('disposes its container on unmount before Vue 3.5', () => {
        const quanta = createQuanta();
        let unmounted = false;
        // An app as Vue 3.3 and 3.4 shape it: no onUnmount hook.
        const app = {
            provide: vi.fn(),
            unmount: () => {
                unmounted = true;
            },
        } as unknown as App;

        quanta.install(app);
        app.unmount();

        expect(unmounted).toBe(true);
        expect(quanta.container.active).toBe(false);
    });

    it('renders on the server against the request container', async () => {
        const useCounter = defineCounter();
        const request = createContainer('request');
        useCounter(request).a = 7;

        const app = createSSRApp(
            defineComponent({
                setup() {
                    const store = useQuanta(useCounter);
                    return () => h('span', String(store.a));
                },
            }),
        );
        app.use(createQuanta({ container: request }));

        expect(await renderToString(app)).toBe('<span>7</span>');
    });
});

describe('provideQuantaContainer', () => {
    it('scopes a subtree to another container', () => {
        const useCounter = defineCounter();
        const inner = createContainer('inner');
        useCounter(inner).a = 3;

        const Child = defineComponent({
            setup() {
                const store = useQuanta(useCounter);
                return () => h('span', String(store.a));
            },
        });
        const { el } = mount(
            defineComponent({
                setup() {
                    provideQuantaContainer(inner);
                    return () => h(Child);
                },
            }),
        );
        expect(el.textContent).toBe('3');
    });
});

describe('useLocalStore', () => {
    it('gives each component instance its own store', async () => {
        const useCounter = defineCounter();
        const stores: ReturnType<typeof useCounter>[] = [];
        const Local = defineComponent({
            setup() {
                const store = useLocalStore(useCounter);
                stores.push(store);
                return () => h('span', String(store.a));
            },
        });
        const { el } = mount(
            defineComponent({ render: () => [h(Local), h(Local)] }),
        );

        stores[0].incA();
        await nextTick();
        expect(el.textContent).toBe('10');
    });

    it('disposes its container with the component', () => {
        const useCounter = defineCounter();
        const listener = vi.fn();
        const scope = effectScope();
        const store = scope.run(() => {
            const local = useLocalStore(useCounter);
            local.subscribe(listener);
            return local;
        })!;

        scope.stop();
        store.incA();

        // A disposed container destroys its stores, which drops every
        // subscriber, not only the one useLocalStore added.
        expect(listener).not.toHaveBeenCalled();
    });
});
