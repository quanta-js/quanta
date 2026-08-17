/**
 * Containers, `defineStore`, SSR hydration and the async action lifecycle.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    defineStore,
    createStore,
    createContainer,
    getDefaultContainer,
    setDefaultContainer,
    destroyAllStores,
    hasStore,
    useStore,
    effect,
    nextTick,
} from '../index';

let uid = 0;
const name = (p: string) => `ct_${p}_${++uid}_${Date.now()}`;

afterEach(() => {
    destroyAllStores();
});

const counter = () =>
    defineStore(name('counter'), {
        state: () => ({ count: 0, label: 'default' }),
        getters: { doubled: (s) => s.count * 2 },
        actions: {
            bump() {
                this.count++;
            },
            setLabel(value: string) {
                this.label = value;
            },
        },
    });

describe('defineStore', () => {
    it('returns an accessor, not an instance', () => {
        const definition = counter();
        expect(typeof definition).toBe('function');
        expect(definition.$id).toContain('ct_counter');
        // Nothing is created until the definition is resolved — which is what
        // makes it safe to declare at module scope on a server.
        expect(hasStore(definition.$id)).toBe(false);
    });

    it('creates the instance on first resolve and reuses it after', () => {
        const definition = counter();
        const first = definition();
        const second = definition();

        expect(second).toBe(first);
        expect(hasStore(definition.$id)).toBe(true);
    });

    it('exposes state, getters and actions on one flat object', () => {
        const store = counter()();

        expect(store.count).toBe(0);
        expect(store.doubled).toBe(0);

        store.bump();
        expect(store.count).toBe(1);
        expect(store.doubled).toBe(2);

        store.setLabel('changed');
        expect(store.label).toBe('changed');
    });

    it('binds `this` in actions to the whole store', () => {
        const definition = defineStore(name('this'), {
            state: () => ({ items: [1, 2, 3] }),
            getters: { total: (s) => s.items.length },
            actions: {
                addAndReport(value: number) {
                    this.items.push(value);
                    // Reaches state, a getter and another action.
                    return `${this.total}:${this.describe()}`;
                },
                describe() {
                    return this.items.join(',');
                },
            },
        });

        expect(definition().addAndReport(4)).toBe('4:1,2,3,4');
    });

    it('rejects an empty name', () => {
        expect(() => defineStore('', { state: () => ({}) })).toThrow(
            /non-empty store name/,
        );
    });
});

describe('containers', () => {
    it('isolates instances of the same definition', () => {
        const definition = counter();
        const a = createContainer('a');
        const b = createContainer('b');

        definition(a).bump();
        definition(a).bump();

        expect(definition(a).count).toBe(2);
        expect(definition(b).count).toBe(0);

        a.dispose();
        b.dispose();
    });

    /**
     * The reason containers exist. Before them, a module-scope store was a
     * process-wide singleton, so one request's data was visible to the next.
     */
    it('keeps two simulated requests from seeing each other', () => {
        const useUser = defineStore(name('user'), {
            state: () => ({ email: '' }),
            actions: {
                signIn(email: string) {
                    this.email = email;
                },
            },
        });

        const requestOne = createContainer('req-1');
        useUser(requestOne).signIn('alice@corp.com');

        const requestTwo = createContainer('req-2');
        expect(useUser(requestTwo).email).toBe('');

        requestOne.dispose();
        requestTwo.dispose();
    });

    it('reports its contents', () => {
        const definition = counter();
        const container = createContainer('inspect');

        expect(container.has(definition.$id)).toBe(false);
        definition(container);

        expect(container.has(definition.$id)).toBe(true);
        expect(container.keys()).toEqual([definition.$id]);
        expect(container.get(definition.$id)).toBeDefined();
        expect(container.get('missing')).toBeUndefined();

        container.dispose();
    });

    it('destroys every store on dispose, releasing their effects', () => {
        const definition = counter();
        const container = createContainer('teardown');
        const store = definition(container);

        let runs = 0;
        store.subscribe(() => runs++);
        store.bump();
        const afterFirst = runs;
        expect(afterFirst).toBeGreaterThan(0);

        container.dispose();
        store.bump();

        expect(runs).toBe(afterFirst);
        expect(container.keys()).toEqual([]);
    });

    it('refuses work after disposal, and disposes idempotently', () => {
        const definition = counter();
        const container = createContainer('closed');
        container.dispose();

        expect(() => definition(container)).toThrow(/after dispose/);
        expect(() => container.dispose()).not.toThrow();
        expect(container.active).toBe(false);
    });

    it('warns when one name is used by two different definitions', async () => {
        const { logger } = await import('../services/logger-service');
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const container = createContainer('collide');
        const shared = name('collision');

        createStore(shared, { state: () => ({ a: 1 }) }, container);
        createStore(shared, { state: () => ({ b: 2 }) }, container);

        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining(
                'already created from a different definition',
            ),
        );

        warn.mockRestore();
        container.dispose();
    });
});

describe('default container', () => {
    it('is used when no container is passed', () => {
        const definition = counter();
        const store = definition();
        expect(getDefaultContainer().get(definition.$id)).toBe(store);
    });

    it('can be swapped for test isolation', () => {
        const definition = counter();
        definition().bump();

        const replacement = createContainer('swapped');
        setDefaultContainer(replacement);

        // A fresh container means a fresh instance.
        expect(definition().count).toBe(0);

        replacement.dispose();
        setDefaultContainer(null);
    });

    it('destroyAllStores() gives a clean slate', () => {
        const definition = counter();
        definition().bump();
        expect(hasStore(definition.$id)).toBe(true);

        destroyAllStores();

        expect(hasStore(definition.$id)).toBe(false);
        expect(definition().count).toBe(0);
    });

    it('useStore() finds a created store and explains when it cannot', () => {
        const definition = counter();
        const store = definition();

        expect(useStore(definition.$id)).toBe(store);
        expect(() => useStore('nope')).toThrow(/does not exist in container/);
    });
});

describe('SSR: dehydrate / hydrate', () => {
    it('round-trips state between two containers', () => {
        const definition = counter();

        const server = createContainer('server');
        const serverStore = definition(server);
        serverStore.bump();
        serverStore.setLabel('rendered');
        const snapshot = server.dehydrate();
        server.dispose();

        const client = createContainer('client');
        client.hydrate(snapshot);
        const clientStore = definition(client);

        expect(clientStore.count).toBe(1);
        expect(clientStore.label).toBe('rendered');
        expect(clientStore.doubled).toBe(2);
        client.dispose();
    });

    it('produces a plain, detached snapshot', () => {
        const definition = defineStore(name('snap'), {
            state: () => ({ nested: { deep: 1 }, list: [1, 2] }),
        });
        const store = definition();
        const snapshot = store.$dehydrate();

        // Mutating the live store must not change an already-taken snapshot.
        store.nested.deep = 99;
        expect(snapshot.nested.deep).toBe(1);

        expect(JSON.stringify(snapshot)).toBe(
            '{"nested":{"deep":1},"list":[1,2]}',
        );
    });

    it('preserves Date, Map and Set through a snapshot', () => {
        const definition = defineStore(name('rich'), {
            state: () => ({
                when: new Date(0),
                byId: new Map([['a', 1]]),
                tags: new Set(['x']),
            }),
        });
        const snapshot = definition().$dehydrate();

        expect(snapshot.when).toBeInstanceOf(Date);
        expect(snapshot.byId).toBeInstanceOf(Map);
        expect(snapshot.tags).toBeInstanceOf(Set);
    });

    it('holds a snapshot for a store that does not exist yet', () => {
        const definition = counter();
        const container = createContainer('lazy');

        container.hydrate({ [definition.$id]: { count: 5 } });
        expect(definition(container).count).toBe(5);

        container.dispose();
    });

    it('hydration is one notification, not one per key', () => {
        const definition = counter();
        const store = definition();

        let notifications = 0;
        store.subscribe(() => notifications++);
        store.$hydrate({ count: 9, label: 'batched' });

        expect(notifications).toBe(1);
        expect(store.count).toBe(9);
        expect(store.label).toBe('batched');
    });

    it('refuses unsafe keys from a snapshot', () => {
        const definition = counter();
        const store = definition();
        const hostile = JSON.parse(
            '{"__proto__":{"polluted":"yes"},"count":3}',
        );

        store.$hydrate(hostile);

        expect(store.count).toBe(3);
        expect(({} as { polluted?: string }).polluted).toBeUndefined();
    });

    it('ignores malformed snapshots rather than throwing', () => {
        const container = createContainer('junk');
        expect(() => container.hydrate(null as never)).not.toThrow();
        expect(() =>
            container.hydrate({ a: 'not-an-object' as never }),
        ).not.toThrow();
        container.dispose();
    });
});

describe('$patch', () => {
    it('applies an object patch as one notification', () => {
        const store = counter()();
        let notifications = 0;
        store.subscribe(() => notifications++);

        store.$patch({ count: 5, label: 'patched' });

        expect(store.count).toBe(5);
        expect(store.label).toBe('patched');
        expect(notifications).toBe(1);
    });

    it('applies a mutator patch as one notification', () => {
        const store = counter()();
        let notifications = 0;
        store.subscribe(() => notifications++);

        store.$patch((state) => {
            state.count = 3;
            state.label = 'mutated';
        });

        expect(store.count).toBe(3);
        expect(notifications).toBe(1);
    });
});

describe('async action lifecycle', () => {
    const asyncStore = () =>
        defineStore(name('async'), {
            state: () => ({ data: null as string | null }),
            actions: {
                async load(value: string, fail = false) {
                    await Promise.resolve();
                    if (fail) throw new Error('load failed');
                    this.data = value;
                    return value;
                },
                sync() {
                    this.data = 'sync';
                },
            },
        });

    it('reports pending across the life of the call', async () => {
        const store = asyncStore()();

        expect(store.load.pending).toBe(false);
        const promise = store.load('x');
        expect(store.load.pending).toBe(true);

        await promise;
        expect(store.load.pending).toBe(false);
        expect(store.data).toBe('x');
    });

    it('captures a rejection and still rethrows it', async () => {
        const store = asyncStore()();

        await expect(store.load('x', true)).rejects.toThrow('load failed');

        expect(store.load.pending).toBe(false);
        expect(store.load.error).toBeInstanceOf(Error);
        expect(store.load.error?.message).toBe('load failed');
    });

    it('clears a previous error when a new call starts', async () => {
        const store = asyncStore()();
        await expect(store.load('x', true)).rejects.toThrow();
        expect(store.load.error).not.toBeNull();

        await store.load('y');
        expect(store.load.error).toBeNull();
    });

    it('stays pending until the last of several overlapping calls settles', async () => {
        const store = asyncStore()();
        const first = store.load('a');
        const second = store.load('b');

        expect(store.load.pending).toBe(true);
        await first;
        await second;
        expect(store.load.pending).toBe(false);
    });

    it('pending is reactive', async () => {
        const store = asyncStore()();
        const seen: boolean[] = [];
        effect(() => seen.push(store.load.pending));

        const promise = store.load('x');
        await promise;
        await nextTick();

        expect(seen[0]).toBe(false);
        expect(seen).toContain(true);
        expect(seen[seen.length - 1]).toBe(false);
    });

    it('exposes an AbortSignal that abort() triggers', async () => {
        let captured: AbortSignal | undefined;
        const definition = defineStore(name('abort'), {
            state: () => ({ done: false }),
            actions: {
                async run() {
                    captured = this.$signal;
                    await new Promise((resolve) => setTimeout(resolve, 5));
                    this.done = true;
                },
            },
        });
        const store = definition();

        const promise = store.run();
        expect(captured).toBeInstanceOf(AbortSignal);
        expect(captured?.aborted).toBe(false);

        store.run.abort('cancelled');
        expect(captured?.aborted).toBe(true);

        await promise;
    });

    it('clears $signal once the action returns', async () => {
        const store = asyncStore()();
        await store.load('x');
        expect(store.$signal).toBeUndefined();
    });

    it('gives synchronous actions the same surface', () => {
        const store = asyncStore()();

        // So that turning an action async later is not a breaking change.
        expect(store.sync.pending).toBe(false);
        expect(store.sync.error).toBeNull();
        expect(typeof store.sync.abort).toBe('function');

        store.sync();
        expect(store.data).toBe('sync');
        expect(store.sync.pending).toBe(false);
    });

    it('records a synchronous throw as an error', () => {
        const definition = defineStore(name('syncthrow'), {
            state: () => ({ n: 0 }),
            actions: {
                boom() {
                    throw new Error('sync boom');
                },
            },
        });
        const store = definition();

        expect(() => store.boom()).toThrow('sync boom');
        expect(store.boom.error?.message).toBe('sync boom');
        expect(store.boom.pending).toBe(false);
    });

    it('aborts in-flight calls when the store is destroyed', async () => {
        let captured: AbortSignal | undefined;
        const definition = defineStore(name('destroyabort'), {
            state: () => ({ n: 0 }),
            actions: {
                async run() {
                    captured = this.$signal;
                    await new Promise((resolve) => setTimeout(resolve, 5));
                },
            },
        });
        const store = definition();
        const promise = store.run();

        store.$destroy();
        expect(captured?.aborted).toBe(true);
        await promise;
    });
});
