/**
 * The escape hatches and guards added in the 2.1 pass.
 *
 * These are public API, so they are tested through the public entry point
 * rather than by importing internals.
 */
import { describe, it, expect, vi } from 'vitest';
import {
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly,
    isReactive,
    isReadonly,
    isProxy,
    toRaw,
    markRaw,
    effect,
    effectScope,
    untrack,
    nextTick,
    batchEffects,
    computed,
    watch,
    createStore,
    sanitizePayload,
    safeJsonParse,
    safeJsonReviver,
    debounce,
} from '../index';
import { flattenStore } from '../utils/flattenStore';

let uid = 0;
const name = (p: string) => `api_${p}_${++uid}_${Date.now()}`;

describe('escape hatches', () => {
    describe('toRaw', () => {
        it('returns the underlying object for a proxy', () => {
            const source = { a: 1 };
            const proxy = reactive(source);
            expect(toRaw(proxy)).toBe(source);
        });

        it('returns non-proxies unchanged', () => {
            const plain = { a: 1 };
            expect(toRaw(plain)).toBe(plain);
            expect(toRaw(42)).toBe(42);
            expect(toRaw(null)).toBe(null);
            expect(toRaw(undefined)).toBe(undefined);
            expect(toRaw('text')).toBe('text');
        });

        it('reading through the raw object does not track', () => {
            const state = reactive({ n: 0 });
            const raw = toRaw(state);
            let runs = 0;
            effect(() => {
                void raw.n;
                runs++;
            });
            state.n = 1;
            expect(runs).toBe(1);
        });
    });

    describe('markRaw', () => {
        it('excludes an object from reactivity', () => {
            const excluded = markRaw({ heavy: true });
            const state = reactive({ excluded });
            expect(isReactive(state.excluded)).toBe(false);
            expect(state.excluded).toBe(excluded);
        });

        it('survives being nested inside reactive state', () => {
            const instance = markRaw({ id: 1 });
            const state = reactive<{ items: Array<{ id: number }> }>({
                items: [],
            });
            state.items.push(instance);
            expect(isProxy(state.items[0])).toBe(false);
        });
    });

    describe('shallowReactive', () => {
        it('tracks top-level properties', () => {
            const state = shallowReactive({ n: 0, nested: { deep: 0 } });
            let runs = 0;
            effect(() => {
                void state.n;
                runs++;
            });
            state.n = 1;
            expect(runs).toBe(2);
        });

        it('leaves nested values unproxied', () => {
            const state = shallowReactive({ nested: { deep: 0 } });
            expect(isReactive(state.nested)).toBe(false);
        });
    });

    describe('readonly', () => {
        it('allows reads and tracks them', () => {
            const source = reactive({ n: 1 });
            const view = readonly(source);
            let seen = 0;
            effect(() => {
                seen = view.n;
            });
            source.n = 5;
            expect(seen).toBe(5);
        });

        it('ignores writes', () => {
            const view = readonly({ n: 1 });
            view.n = 99;
            expect(view.n).toBe(1);
        });

        it('ignores deletes', () => {
            const view = readonly<{ n?: number }>({ n: 1 });
            delete view.n;
            expect(view.n).toBe(1);
        });

        it('blocks array and collection mutators', () => {
            const list = readonly({ items: [1, 2] });
            list.items.push(3);
            expect(list.items.length).toBe(2);

            const collection = readonly({ map: new Map([['a', 1]]) });
            collection.map.set('b', 2);
            collection.map.delete('a');
            collection.map.clear();
            expect(collection.map.size).toBe(1);
        });

        it('is reported by isReadonly, not isReactive', () => {
            const view = readonly({ n: 1 });
            expect(isReadonly(view)).toBe(true);
            expect(isReactive(view)).toBe(false);
            expect(isProxy(view)).toBe(true);
        });

        it('shallowReadonly leaves nested values unproxied', () => {
            const view = shallowReadonly({ nested: { deep: 1 } });
            expect(isProxy(view.nested)).toBe(false);
        });
    });

    describe('untrack', () => {
        it('prevents reads inside it from becoming dependencies', () => {
            const state = reactive({ tracked: 0, hidden: 0 });
            let runs = 0;
            effect(() => {
                void state.tracked;
                untrack(() => void state.hidden);
                runs++;
            });

            state.hidden = 1;
            expect(runs).toBe(1);

            state.tracked = 1;
            expect(runs).toBe(2);
        });

        it('returns the callback result and restores tracking after a throw', () => {
            expect(untrack(() => 7)).toBe(7);

            const state = reactive({ n: 0 });
            let runs = 0;
            effect(() => {
                void state.n;
                try {
                    untrack(() => {
                        throw new Error('inner');
                    });
                } catch {
                    /* expected */
                }
                runs++;
            });

            state.n = 1;
            expect(runs).toBe(2);
        });
    });

    describe('nextTick', () => {
        it('resolves after the current microtask queue', async () => {
            const order: string[] = [];
            const done = nextTick(() => order.push('tick'));
            order.push('sync');
            await done;
            expect(order).toEqual(['sync', 'tick']);
        });

        it('resolves without a callback', async () => {
            await expect(nextTick()).resolves.toBeUndefined();
        });
    });

    describe('effectScope', () => {
        it('captures nested scopes independently', () => {
            const state = reactive({ n: 0 });
            let outer = 0;
            let inner = 0;

            const outerScope = effectScope();
            const innerScope = effectScope();

            outerScope.run(() => {
                effect(() => {
                    void state.n;
                    outer++;
                });
                innerScope.run(() => {
                    effect(() => {
                        void state.n;
                        inner++;
                    });
                });
            });

            state.n = 1;
            expect(outer).toBe(2);
            expect(inner).toBe(2);

            innerScope.stop();
            state.n = 2;
            expect(outer).toBe(3);
            expect(inner).toBe(2);
        });

        it('still runs the callback on a stopped scope, without capturing', () => {
            const scope = effectScope();
            scope.stop();
            expect(scope.run(() => 'value')).toBe('value');
        });
    });
});

describe('untrusted-input guards', () => {
    describe('sanitizePayload', () => {
        it('strips __proto__ at the top level', () => {
            const hostile = JSON.parse('{"a":1,"__proto__":{"bad":true}}');
            const safe = sanitizePayload(hostile) as Record<string, unknown>;
            expect(safe.a).toBe(1);
            expect(
                Object.prototype.hasOwnProperty.call(safe, '__proto__'),
            ).toBe(false);
        });

        it('strips dangerous keys at every depth', () => {
            const hostile = JSON.parse(
                '{"deep":{"nested":{"__proto__":{"bad":true},"ok":1}}}',
            );
            const safe = sanitizePayload(hostile) as {
                deep: { nested: Record<string, unknown> };
            };
            expect(safe.deep.nested.ok).toBe(1);
            expect(
                Object.prototype.hasOwnProperty.call(
                    safe.deep.nested,
                    '__proto__',
                ),
            ).toBe(false);
        });

        it('strips constructor and prototype', () => {
            const hostile = JSON.parse(
                '{"constructor":{"x":1},"prototype":{"y":2},"keep":3}',
            );
            const safe = sanitizePayload(hostile) as Record<string, unknown>;
            expect(Object.keys(safe)).toEqual(['keep']);
        });

        it('walks arrays', () => {
            const hostile = JSON.parse('[{"__proto__":{"bad":1},"ok":2}]');
            const safe = sanitizePayload(hostile) as Array<
                Record<string, unknown>
            >;
            expect(safe[0].ok).toBe(2);
            expect(
                Object.prototype.hasOwnProperty.call(safe[0], '__proto__'),
            ).toBe(false);
        });

        it('passes primitives and exotic objects through untouched', () => {
            const date = new Date(0);
            expect(sanitizePayload(42)).toBe(42);
            expect(sanitizePayload(null)).toBe(null);
            expect(sanitizePayload('text')).toBe('text');
            expect(sanitizePayload(date)).toBe(date);
        });

        it('collapses a cycle instead of overflowing', () => {
            const cyclic: Record<string, unknown> = { a: 1 };
            cyclic.self = cyclic;
            expect(() => sanitizePayload(cyclic)).not.toThrow();
        });
    });

    describe('safeJsonParse', () => {
        it('drops dangerous keys during parsing', () => {
            const parsed = safeJsonParse(
                '{"safe":1,"__proto__":{"bad":true}}',
            ) as Record<string, unknown>;
            expect(parsed.safe).toBe(1);
            expect(
                Object.prototype.hasOwnProperty.call(parsed, '__proto__'),
            ).toBe(false);
        });

        it('is a drop-in for JSON.parse on benign input', () => {
            expect(safeJsonParse('{"a":[1,2],"b":"x"}')).toEqual({
                a: [1, 2],
                b: 'x',
            });
        });

        it('exposes the reviver for custom deserializers', () => {
            expect(safeJsonReviver('safe', 1)).toBe(1);
            expect(safeJsonReviver('__proto__', {})).toBeUndefined();
        });
    });

    it('a poisoned persistence payload cannot reach the prototype', () => {
        const store = createStore(name('poison'), {
            state: () => ({ safe: 1 }),
        });
        const flat = store as unknown as Record<string, unknown>;

        // Mirrors what the persistence layer does with adapter output.
        const hostile = safeJsonParse(
            '{"__proto__":{"polluted":"yes"},"safe":2}',
        ) as Record<string, unknown>;
        for (const key of Object.keys(hostile)) {
            flat[key] = hostile[key];
        }

        expect(flat.safe).toBe(2);
        expect((flat as { polluted?: string }).polluted).toBeUndefined();
        expect(({} as { polluted?: string }).polluted).toBeUndefined();

        store.$destroy();
    });
});

describe('flattenStore traps', () => {
    const build = () =>
        flattenStore({
            state: { count: 1, label: 'x' },
            getters: { doubled: { value: 2 } },
            actions: { act: () => 'ran' },
            $reset: () => {},
            $destroy: () => {},
        } as never) as unknown as Record<string, unknown>;

    it('reports membership across state, getters and actions', () => {
        const flat = build();
        expect('count' in flat).toBe(true);
        expect('doubled' in flat).toBe(true);
        expect('act' in flat).toBe(true);
        expect('missing' in flat).toBe(false);
    });

    it('enumerates the union of all three buckets', () => {
        const keys = Object.keys(build());
        expect(keys).toEqual(
            expect.arrayContaining(['count', 'label', 'doubled', 'act']),
        );
    });

    it('is spreadable', () => {
        const spread = { ...build() } as Record<string, unknown>;
        expect(spread.count).toBe(1);
        expect(spread.doubled).toBe(2);
    });

    it('writes fall through to state', () => {
        const flat = build();
        flat.count = 9;
        expect(flat.count).toBe(9);
    });

    it('writes to an unknown key land on the store object', () => {
        const flat = build();
        flat.extra = 'value';
        expect(flat.extra).toBe('value');
    });

    it('exposes property descriptors for derived members', () => {
        const descriptor = Object.getOwnPropertyDescriptor(build(), 'doubled');
        expect(descriptor?.value).toBe(2);
        expect(descriptor?.configurable).toBe(true);
    });
});

describe('debounce', () => {
    it('collapses rapid calls into one', async () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 50);

        debounced('a');
        debounced('b');
        debounced('c');
        expect(fn).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(60);
        expect(fn).toHaveBeenCalledOnce();
        expect(fn).toHaveBeenCalledWith('c');
        vi.useRealTimers();
    });

    it('flush() runs the pending call immediately', async () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 1000);
        debounced('x');
        await debounced.flush();
        expect(fn).toHaveBeenCalledWith('x');
    });

    it('cancel() discards the pending call', async () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 50);
        debounced('x');
        debounced.cancel();
        await vi.advanceTimersByTimeAsync(60);
        expect(fn).not.toHaveBeenCalled();
        vi.useRealTimers();
    });
});

describe('composition', () => {
    it('watch, computed and batching cooperate on nested state', () => {
        const state = reactive({ user: { first: 'Ada', last: 'Lovelace' } });
        const full = computed(() => `${state.user.first} ${state.user.last}`);

        const seen: string[] = [];
        watch(
            () => full.value,
            (value) => seen.push(value),
        );

        batchEffects(() => {
            state.user.first = 'Grace';
            state.user.last = 'Hopper';
        });

        // One batch, one notification, final value only.
        expect(seen).toEqual(['Grace Hopper']);
        expect(full.value).toBe('Grace Hopper');
    });

    it('computed exposes peek() and invalidate()', () => {
        const state = reactive({ n: 1 });
        let calls = 0;
        const doubled = computed(() => {
            calls++;
            return state.n * 2;
        });

        expect(doubled.peek()).toBe(2);
        expect(doubled.dirty).toBe(false);
        expect(doubled.peek()).toBe(2);
        expect(calls).toBe(1);

        doubled.invalidate();
        expect(doubled.dirty).toBe(true);
        expect(doubled.value).toBe(2);
        expect(calls).toBe(2);
    });
});
