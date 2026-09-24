/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { LitElement, html } from 'lit';
import { ContextProvider } from '@lit/context';
import {
    createContainer,
    defineStore,
    destroyAllStores,
    shallow,
    type StoreContainer,
} from '@quantajs/core';
import {
    QuantaActionsController,
    QuantaController,
    QuantaLocalController,
    QuantaValueController,
    provideQuantaContainer,
    quantaContainerContext,
    requestQuantaContainer,
} from '../index';

let uid = 0;
const tag = (p: string) => `q-${p}-${++uid}`;
const tick = () => new Promise((r) => setTimeout(r, 0));

const defineCounter = () =>
    defineStore(`lit_counter_${++uid}`, {
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
type Definition = ReturnType<typeof defineCounter>;
type Counter = ReturnType<Definition>;

/** An element that renders `read()` and counts its renders. */
function define(
    setup: (host: LitElement) => { read: () => unknown },
): () => LitElement & { renders: number; read: () => unknown } {
    const name = tag('el');
    class Element extends LitElement {
        renders = 0;
        read: () => unknown;
        constructor() {
            super();
            this.read = setup(this).read;
        }
        render() {
            this.renders++;
            return html`${String(this.read())}`;
        }
    }
    customElements.define(name, Element);
    return () =>
        document.createElement(name) as unknown as Element & {
            renders: number;
        };
}

async function attach<T extends LitElement>(
    element: T,
    parent: Node = document.body,
): Promise<T> {
    parent.appendChild(element);
    await element.updateComplete;
    return element;
}

const text = (element: LitElement) =>
    element.shadowRoot?.textContent?.trim() ?? '';

afterEach(() => {
    document.body.innerHTML = '';
    destroyAllStores();
});

describe('QuantaValueController', () => {
    it('updates only the elements whose selection changed', async () => {
        const useCounter = defineCounter();
        const makeA = define((host) => {
            const c = new QuantaValueController(host, useCounter, (s) => s.a);
            return { read: () => c.value };
        });
        const makeB = define((host) => {
            const c = new QuantaValueController(host, useCounter, (s) => s.b);
            return { read: () => c.value };
        });
        const a = await attach(makeA());
        const b = await attach(makeB());

        useCounter().incA();
        await a.updateComplete;
        await b.updateComplete;

        expect(text(a)).toBe('1');
        expect(a.renders).toBe(2);
        expect(b.renders).toBe(1);
    });

    it('updates when a selected object is mutated in place', async () => {
        const useCounter = defineCounter();
        const make = define((host) => {
            const c = new QuantaValueController(
                host,
                useCounter,
                (s) => s.items,
            );
            return { read: () => c.value.length };
        });
        const element = await attach(make());

        useCounter().items.push(1);
        await element.updateComplete;
        expect(text(element)).toBe('1');
    });

    it('skips selections the equality function calls equal', async () => {
        const useCounter = defineCounter();
        const make = define((host) => {
            const c = new QuantaValueController(
                host,
                useCounter,
                (s) => ({ even: s.a % 2 === 0 }),
                { equalityFn: shallow },
            );
            return { read: () => c.value.even };
        });
        const element = await attach(make());

        useCounter().a = 2;
        await element.updateComplete;
        expect(element.renders).toBe(1);

        useCounter().a = 3;
        await element.updateComplete;
        expect(element.renders).toBe(2);
        expect(text(element)).toBe('false');
    });

    it('stops updating once disconnected', async () => {
        const useCounter = defineCounter();
        const make = define((host) => {
            const c = new QuantaValueController(host, useCounter, (s) => s.a);
            return { read: () => c.value };
        });
        const element = await attach(make());
        element.remove();

        useCounter().incA();
        await tick();
        expect(element.renders).toBe(1);
    });

    it('reads the value before the element connects', () => {
        const useCounter = defineCounter();
        useCounter().a = 7;
        let controller!: QuantaValueController<any, any, any, number>;
        const make = define((host) => {
            controller = new QuantaValueController(
                host,
                useCounter,
                (s) => s.a,
            );
            return { read: () => controller.value };
        });
        make();
        expect(controller.value).toBe(7);
    });
});

describe('QuantaController', () => {
    it('updates on any change and reads getters', async () => {
        const useCounter = defineCounter();
        const make = define((host) => {
            const c = new QuantaController(host, useCounter);
            return { read: () => `${c.store.a}/${c.store.total}` };
        });
        const element = await attach(make());
        expect(text(element)).toBe('0/0');

        useCounter().b = 2;
        await element.updateComplete;
        expect(text(element)).toBe('0/2');
    });
});

describe('QuantaActionsController', () => {
    it('never updates its element', async () => {
        const useCounter = defineCounter();
        let actions!: QuantaActionsController<any, any, any>;
        const make = define((host) => {
            actions = new QuantaActionsController(host, useCounter);
            return { read: () => 'actions' };
        });
        const element = await attach(make());

        (actions.store as Counter).incA();
        await tick();
        expect(element.renders).toBe(1);
        expect(useCounter().a).toBe(1);
    });
});

describe('containers', () => {
    function valueOf(useCounter: Definition) {
        return define((host) => {
            const c = new QuantaValueController(host, useCounter, (s) => s.a);
            return { read: () => c.value };
        });
    }

    it('resolves descendants against a provided container', async () => {
        const useCounter = defineCounter();
        const scoped = createContainer('scoped');
        useCounter(scoped).a = 3;
        const makeRoot = define((host) => {
            provideQuantaContainer(host as LitElement, scoped);
            return { read: () => '' };
        });
        const root = await attach(makeRoot());
        const child = await attach(valueOf(useCounter)(), root);

        expect(text(child)).toBe('3');
        expect(useCounter().a).toBe(0);
    });

    it('reaches descendants inside the provider’s shadow root', async () => {
        const useCounter = defineCounter();
        const scoped = createContainer('shadow');
        useCounter(scoped).a = 4;
        const childTag = tag('child');
        customElements.define(
            childTag,
            class extends LitElement {
                c = new QuantaValueController(this, useCounter, (s) => s.a);
                render() {
                    return html`${this.c.value}`;
                }
            },
        );
        const makeRoot = define((host) => {
            provideQuantaContainer(host as LitElement, scoped);
            return { read: () => '' };
        });
        const root = await attach(makeRoot());
        const child = document.createElement(childTag) as LitElement;
        root.shadowRoot!.appendChild(child);
        await child.updateComplete;

        expect(text(child)).toBe('4');
    });

    it('works with @lit/context providers', async () => {
        const useCounter = defineCounter();
        const scoped = createContainer('lit-context');
        useCounter(scoped).a = 5;
        const makeRoot = define((host) => {
            new ContextProvider(host as LitElement, {
                context: quantaContainerContext,
                initialValue: scoped,
            });
            return { read: () => '' };
        });
        const root = await attach(makeRoot());
        const child = await attach(valueOf(useCounter)(), root);

        expect(text(child)).toBe('5');
    });

    it('disposes a container it created only when the provider is removed', async () => {
        let owned!: StoreContainer;
        const makeRoot = define((host) => {
            owned = provideQuantaContainer(host as LitElement);
            return { read: () => '' };
        });
        const root = await attach(makeRoot());

        // Moving: removed and re-added in the same task.
        root.remove();
        document.body.appendChild(root);
        await tick();
        expect(owned.active).toBe(true);

        root.remove();
        await tick();
        expect(owned.active).toBe(false);
    });

    it('falls back to the default container for a non-element host', () => {
        const host = {
            addController: vi.fn(),
            removeController: vi.fn(),
            requestUpdate: vi.fn(),
            updateComplete: Promise.resolve(true),
        };
        expect(requestQuantaContainer(host)).toBeUndefined();
    });
});

describe('QuantaLocalController', () => {
    it('gives each element its own store, kept across a move', async () => {
        const useCounter = defineCounter();
        const stores: Counter[] = [];
        const make = define((host) => {
            const c = new QuantaLocalController(host, useCounter);
            return {
                read: () => {
                    if (!stores.includes(c.store as Counter))
                        stores.push(c.store as Counter);
                    return c.store.a;
                },
            };
        });
        const first = await attach(make());
        const second = await attach(make());

        stores[0].incA();
        await first.updateComplete;
        expect(text(first)).toBe('1');
        expect(text(second)).toBe('0');

        first.remove();
        document.body.appendChild(first);
        await tick();
        await first.updateComplete;
        expect(text(first)).toBe('1');
    });

    it('disposes its store when the element is removed', async () => {
        const useCounter = defineCounter();
        let controller!: QuantaLocalController<any, any, any>;
        const make = define((host) => {
            controller = new QuantaLocalController(host, useCounter);
            return { read: () => controller.store.a };
        });
        const element = await attach(make());
        const store = controller.store as Counter;
        const listener = vi.fn();
        store.subscribe(listener);

        element.remove();
        await tick();
        store.incA();

        // A disposed container drops every subscriber of its stores.
        expect(listener).not.toHaveBeenCalled();
    });
});
