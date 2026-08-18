/**
 * Structural guards on the write path's complexity.
 *
 * A timing assertion cannot gate CI — shared runners are far too noisy — so
 * these assert the *shape* that makes the timing possible instead. They are
 * deterministic, and they fail the moment the O(n) they exist to prevent
 * comes back.
 *
 * The regression they guard: the store's coarse change-notifier used to be an
 * effect whose body enumerated every state key. Because an effect re-runs to
 * re-register its dependencies, a single property write re-read the entire
 * store — measured at 5.8us on a 5-key store and 439us on a 400-key one.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
    defineStore,
    createContainer,
    reactive,
    effect,
    toRaw,
} from '../index';
import { targetMap } from '../core/effect';
import { ANY_CHANGE } from '../utils/deep-trigger';

let containers: Array<ReturnType<typeof createContainer>> = [];
const fresh = () => {
    const c = createContainer();
    containers.push(c);
    return c;
};

afterEach(() => {
    for (const c of containers) c.dispose();
    containers = [];
});

/** How many distinct properties of `target` have subscribers. */
function trackedPropertyCount(target: object): number {
    const deps = targetMap.get(toRaw(target));
    if (deps === undefined) return 0;
    let live = 0;
    for (const dep of deps.values()) if (dep.size > 0) live++;
    return live;
}

const storeWith = (keyCount: number, name: string) => {
    const initial: Record<string, number> = {};
    for (let i = 0; i < keyCount; i++) initial['k' + i] = i;
    return defineStore(name, {
        state: () => ({ ...initial }),
        actions: {
            bump() {
                (this as unknown as Record<string, number>).k0++;
            },
        },
    })(fresh());
};

describe('write-path complexity', () => {
    it('the store notifier subscribes to a constant number of dependencies', () => {
        const small = storeWith(5, 'complexity_small');
        const large = storeWith(500, 'complexity_large');

        small.subscribe(() => {});
        large.subscribe(() => {});

        // One dependency — the coarse channel — regardless of state size. If
        // this ever tracks the key count again, every write is O(state size).
        expect(trackedPropertyCount(small.state)).toBe(1);
        expect(trackedPropertyCount(large.state)).toBe(1);
    });

    it('subscribes via the coarse channel, not per key', () => {
        const store = storeWith(20, 'complexity_channel');
        store.subscribe(() => {});

        const deps = targetMap.get(toRaw(store.state))!;
        const live = [...deps.entries()].filter(([, dep]) => dep.size > 0);

        expect(live).toHaveLength(1);
        expect(live[0][0]).toBe(ANY_CHANGE);
    });

    it('does not grow its dependency set as writes accumulate', () => {
        const store = storeWith(30, 'complexity_stable');
        store.subscribe(() => {});

        const before = trackedPropertyCount(store.state);
        for (let i = 0; i < 200; i++) store.bump();
        // A notifier that re-registered on every run would drift here; one
        // that uses a scheduler never re-runs its body at all.
        expect(trackedPropertyCount(store.state)).toBe(before);
    });

    it('still notifies for keys added after the store was created', () => {
        const store = storeWith(3, 'complexity_latekey');
        let notifications = 0;
        store.subscribe(() => {
            notifications++;
        });

        // The coarse channel fires for any key on the object, including one
        // that did not exist when the notifier subscribed — which the old
        // enumerate-every-key approach only handled by re-running.
        (store.state as Record<string, unknown>).addedLater = 1;
        expect(notifications).toBeGreaterThan(0);

        const after = notifications;
        (store.state as Record<string, unknown>).addedLater = 2;
        expect(notifications).toBeGreaterThan(after);
    });

    it('releases the coarse channel when a store is disposed', () => {
        // The gate in `trigger` is a counter of live coarse subscribers. If it
        // only ever incremented, the lookup it guards would stay switched on
        // for the rest of the process after the first store was created — the
        // optimisation would work exactly once, which is the kind of thing
        // that silently rots without a test.
        const container = createContainer();
        const store = defineStore('complexity_release', {
            state: () => ({ a: 1 }),
        })(container);
        store.subscribe(() => {});

        const raw = toRaw(store.state);
        expect(targetMap.get(raw)?.get(ANY_CHANGE)?.size ?? 0).toBe(1);

        container.dispose();

        expect(targetMap.get(raw)?.get(ANY_CHANGE)?.size ?? 0).toBe(0);
    });

    it('a plain reactive object gains no coarse-channel overhead', () => {
        // The ANY_CHANGE lookup on the write path is gated on some store
        // actually using it, so a bare reactive object must not register one.
        const plain = reactive({ a: 1, b: 2 });
        effect(() => {
            void plain.a;
        });

        const deps = targetMap.get(toRaw(plain));
        expect(deps?.get(ANY_CHANGE)?.size ?? 0).toBe(0);
    });
});
