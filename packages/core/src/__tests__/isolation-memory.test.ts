/// <reference lib="es2021.weakref" />
/**
 * The two properties containers exist to guarantee, checked directly:
 * requests handled at the same time never see each other's state, and a
 * disposed container leaves nothing behind that keeps its stores alive.
 */
import { describe, it, expect, afterEach } from 'vitest';
import v8 from 'node:v8';
import vm from 'node:vm';
import {
    computed,
    createContainer,
    defineStore,
    destroyAllStores,
    getDefaultContainer,
    watch,
} from '../index';

let uid = 0;
const name = (p: string) => `iso_${p}_${++uid}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => destroyAllStores());

describe('concurrent containers', () => {
    it('keep interleaved async requests apart', async () => {
        const cartName = name('cart');
        const useCart = defineStore(cartName, {
            state: () => ({ user: '', items: [] as string[] }),
            actions: {
                async load(user: string, delay: number) {
                    this.user = user;
                    await sleep(delay);
                    this.items.push(`${user}-item`);
                },
            },
        });

        // Like a server handling two requests: the first to start finishes last.
        const handle = async (user: string, delay: number) => {
            const container = createContainer(user);
            await useCart(container).load(user, delay);
            const snapshot = container.dehydrate();
            container.dispose();
            return snapshot[cartName];
        };
        const [ada, bob] = await Promise.all([
            handle('ada', 20),
            handle('bob', 5),
        ]);

        expect(ada).toEqual({ user: 'ada', items: ['ada-item'] });
        expect(bob).toEqual({ user: 'bob', items: ['bob-item'] });
        expect(getDefaultContainer().has(cartName)).toBe(false);
    });
});

describe('disposal', () => {
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc') as () => void;

    /** Collect until `ref` is cleared, or give up after a few rounds. */
    async function collected(ref: WeakRef<object>): Promise<boolean> {
        for (let round = 0; round < 10 && ref.deref() !== undefined; round++) {
            await sleep(0);
            gc();
        }
        return ref.deref() === undefined;
    }

    it('lets a disposed container and its stores be collected', async () => {
        let storeRef!: WeakRef<object>;
        let containerRef!: WeakRef<object>;

        (() => {
            const useCounter = defineStore(name('counter'), {
                state: () => ({ count: 0, nested: { deep: [1, 2, 3] } }),
                getters: { doubled: (s) => s.count * 2 },
                actions: {
                    inc() {
                        this.count++;
                    },
                },
            });
            const container = createContainer('memory');
            const store = useCounter(container);
            // Exercise the paths that register dependencies and listeners.
            store.inc();
            void store.doubled;
            void store.nested.deep.map((n) => n);
            store.subscribe(() => {});
            storeRef = new WeakRef(store);
            containerRef = new WeakRef(container);
            container.dispose();
        })();

        expect(await collected(storeRef)).toBe(true);
        expect(await collected(containerRef)).toBe(true);
    });

    it('lets state watched by a stopped watcher and computed be collected', async () => {
        let stateRef!: WeakRef<object>;

        (() => {
            const useThing = defineStore(name('thing'), {
                state: () => ({ items: [{ id: 1 }, { id: 2 }] }),
            });
            const container = createContainer('watched');
            const store = useThing(container);
            const total = computed(() => store.items.length);
            const stop = watch(
                () => store.items.map((i) => i.id),
                () => {},
            );
            void total.value;
            stateRef = new WeakRef(store.state);
            stop();
            total.stop?.();
            container.dispose();
        })();

        expect(await collected(stateRef)).toBe(true);
    });
});
