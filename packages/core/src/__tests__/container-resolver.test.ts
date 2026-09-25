import { describe, it, expect, afterEach } from 'vitest';
import { AsyncLocalStorage } from 'node:async_hooks';
import {
    createContainer,
    defineStore,
    getDefaultContainer,
    resetDefaultContainer,
    setDefaultContainerResolver,
    type StoreContainer,
} from '../index';

let uid = 0;
const name = (p: string) => `resolver_${p}_${++uid}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
    setDefaultContainerResolver(null);
    resetDefaultContainer();
});

describe('setDefaultContainerResolver', () => {
    it('resolves stores without a container against the resolved one', () => {
        const useCounter = defineStore(name('counter'), {
            state: () => ({ count: 0 }),
        });
        const request = createContainer('request');
        setDefaultContainerResolver(() => request);

        useCounter().count = 5;

        expect(getDefaultContainer()).toBe(request);
        expect(useCounter(request).count).toBe(5);
        setDefaultContainerResolver(null);
        expect(useCounter().count).toBe(0);
    });

    it('falls back to the default container when the resolver returns undefined', () => {
        setDefaultContainerResolver(() => undefined);
        const fallback = getDefaultContainer();
        expect(fallback).toBe(getDefaultContainer());
        expect(fallback.id).toMatch(/default/);
    });

    it('does not fall back when the resolved container is disposed', () => {
        const useCounter = defineStore(name('disposed'), {
            state: () => ({ count: 0 }),
        });
        const request = createContainer('request');
        request.dispose();
        setDefaultContainerResolver(() => request);

        expect(() => useCounter()).toThrow(/dispose/);
    });

    it('keeps concurrent requests apart with AsyncLocalStorage', async () => {
        const cartName = name('cart');
        const useCart = defineStore(cartName, {
            state: () => ({ user: '' }),
            actions: {
                async load(user: string, delay: number) {
                    await sleep(delay);
                    this.user = user;
                },
            },
        });
        const requests = new AsyncLocalStorage<StoreContainer>();
        setDefaultContainerResolver(() => requests.getStore());

        // Code inside a request never passes a container, as a component
        // rendered on the server would not.
        const handle = (user: string, delay: number) =>
            requests.run(createContainer(user), async () => {
                await useCart().load(user, delay);
                await sleep(1);
                return useCart().user;
            });
        const [ada, bob] = await Promise.all([
            handle('ada', 20),
            handle('bob', 5),
        ]);

        expect(ada).toBe('ada');
        expect(bob).toBe('bob');
        expect(getDefaultContainer().has(cartName)).toBe(false);
    });
});
