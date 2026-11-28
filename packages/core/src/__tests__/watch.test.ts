import { describe, it, expect, vi } from 'vitest';
import watch from '../state/watch';
import { createReactive } from '../core/create-reactive';
import { shallow } from '../utils/shallow';

describe('watch', () => {
    describe('basic watching', () => {
        it('should NOT invoke callback immediately by default (immediate: false)', () => {
            const state = createReactive({ count: 0 });
            const callback = vi.fn();

            watch(() => state.count, callback);

            expect(callback).not.toHaveBeenCalled();
        });

        it('should detect value changes', () => {
            const state = createReactive({ count: 0 });
            const callback = vi.fn();

            watch(() => state.count, callback);
            callback.mockClear();

            state.count = 5;
            expect(callback).toHaveBeenCalledWith(5, 0);
        });

        it('should not fire when value stays the same (Object.is)', () => {
            const state = createReactive({ count: 5 });
            const callback = vi.fn();

            watch(() => state.count, callback);
            callback.mockClear();

            state.count = 5; // same value
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('immediate option', () => {
        it('should not invoke immediately when immediate: false', () => {
            const state = createReactive({ count: 0 });
            const callback = vi.fn();

            watch(() => state.count, callback, { immediate: false });

            expect(callback).not.toHaveBeenCalled();

            state.count = 1;
            expect(callback).toHaveBeenCalledWith(1, 0);
        });

        it('should invoke immediately with undefined oldValue when immediate: true', () => {
            const state = createReactive({ count: 0 });
            const callback = vi.fn();

            watch(() => state.count, callback, { immediate: true });

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(0, undefined);

            state.count = 1;
            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback).toHaveBeenLastCalledWith(1, 0);
        });
    });

    describe('deep watching', () => {
        it('should detect nested property changes with deep: true', () => {
            const state = createReactive({
                nested: { value: 1 },
            });
            const callback = vi.fn();

            watch(() => state.nested, callback, { deep: true });
            callback.mockClear();

            state.nested.value = 42;
            expect(callback).toHaveBeenCalled();
        });

        it('should detect deeply nested changes', () => {
            const state = createReactive({
                a: { b: { c: 'original' } },
            });
            const callback = vi.fn();

            watch(() => state.a, callback, { deep: true });
            callback.mockClear();

            state.a.b.c = 'changed';
            expect(callback).toHaveBeenCalled();
        });

        it('should handle deep watching of arrays', () => {
            const state = createReactive({
                items: [{ id: 1, name: 'a' }],
            });
            const callback = vi.fn();

            watch(() => state.items, callback, { deep: true });
            callback.mockClear();

            state.items[0].name = 'modified';
            expect(callback).toHaveBeenCalled();
        });

        it('should handle deep watching of Map mutations (set, delete, clear)', () => {
            const state = createReactive({
                map: new Map<string, number>(),
            });
            const callback = vi.fn();

            watch(() => state.map, callback, { deep: true });
            expect(callback).not.toHaveBeenCalled();

            state.map.set('a', 1);
            expect(callback).toHaveBeenCalledTimes(1);

            state.map.set('a', 2);
            expect(callback).toHaveBeenCalledTimes(2);

            // Setting the same value is a no-op and must not re-fire
            state.map.set('a', 2);
            expect(callback).toHaveBeenCalledTimes(2);

            state.map.delete('a');
            expect(callback).toHaveBeenCalledTimes(3);

            state.map.set('b', 10);
            expect(callback).toHaveBeenCalledTimes(4);

            state.map.clear();
            expect(callback).toHaveBeenCalledTimes(5);
        });

        it('should detect nested value changes inside Map entries with deep: true', () => {
            const keyObj = { id: 1 };
            const state = createReactive({
                users: new Map<
                    object | string,
                    { score: number; meta: { active: boolean } }
                >([
                    ['alice', { score: 10, meta: { active: true } }],
                    [keyObj, { score: 20, meta: { active: false } }],
                ]),
            });
            const callback = vi.fn();

            watch(() => state.users, callback, { deep: true });
            expect(callback).not.toHaveBeenCalled();

            state.users.get('alice')!.score = 25;
            expect(callback).toHaveBeenCalledTimes(1);

            state.users.get(keyObj)!.meta.active = true;
            expect(callback).toHaveBeenCalledTimes(2);
        });

        it('should handle deep watching of Set mutations (add, delete, clear)', () => {
            const state = createReactive({
                tags: new Set<string>(),
            });
            const callback = vi.fn();

            watch(() => state.tags, callback, { deep: true });
            expect(callback).not.toHaveBeenCalled();

            state.tags.add('alpha');
            expect(callback).toHaveBeenCalledTimes(1);

            // Duplicate add is a no-op
            state.tags.add('alpha');
            expect(callback).toHaveBeenCalledTimes(1);

            state.tags.delete('alpha');
            expect(callback).toHaveBeenCalledTimes(2);

            state.tags.add('beta');
            expect(callback).toHaveBeenCalledTimes(3);

            state.tags.clear();
            expect(callback).toHaveBeenCalledTimes(4);
        });

        it('should detect nested property changes on objects inside a Set with deep: true', () => {
            const state = createReactive({
                items: new Set([{ id: 1, count: 0 }]),
            });
            const callback = vi.fn();

            watch(() => state.items, callback, { deep: true });
            expect(callback).not.toHaveBeenCalled();

            const [reactiveItem] = [...state.items];
            reactiveItem.count = 5;
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle cyclic structures without infinite recursion', () => {
            interface Node {
                value: number;
                self?: Node;
                peer?: Node;
            }
            const a: Node = { value: 1 };
            const b: Node = { value: 2, peer: a };
            a.self = a;
            a.peer = b;

            const state = createReactive({ root: a });
            const callback = vi.fn();

            watch(() => state.root, callback, { deep: true });
            expect(callback).not.toHaveBeenCalled();

            state.root.value = 10;
            expect(callback).toHaveBeenCalledTimes(1);

            state.root.peer!.value = 20;
            expect(callback).toHaveBeenCalledTimes(2);
        });

        it('should handle cyclic references inside Map and Set with deep: true', () => {
            const map = createReactive(
                new Map<string, { count: number; back?: unknown }>(),
            );
            const entry: { count: number; back?: unknown } = { count: 0 };
            entry.back = map;
            map.set('self', entry);

            const set = createReactive(new Set<unknown>());
            const setItem: { label: string; container?: unknown } = {
                label: 'x',
            };
            setItem.container = set;
            set.add(setItem);

            const mapCb = vi.fn();
            const setCb = vi.fn();
            watch(() => map, mapCb, { deep: true });
            watch(() => set, setCb, { deep: true });

            map.get('self')!.count = 1;
            expect(mapCb).toHaveBeenCalledTimes(1);

            const [item] = [...set] as Array<{ label: string }>;
            item.label = 'y';
            expect(setCb).toHaveBeenCalledTimes(1);
        });
    });

    describe('watching primitives', () => {
        it('should watch string changes', () => {
            const state = createReactive({ name: 'hello' });
            const callback = vi.fn();

            watch(() => state.name, callback);
            callback.mockClear();

            state.name = 'world';
            expect(callback).toHaveBeenCalledWith('world', 'hello');
        });

        it('should watch boolean changes', () => {
            const state = createReactive({ flag: false });
            const callback = vi.fn();

            watch(() => state.flag, callback);
            callback.mockClear();

            state.flag = true;
            expect(callback).toHaveBeenCalledWith(true, false);
        });
    });

    describe('computed source', () => {
        it('should watch derived values', () => {
            const state = createReactive({ a: 1, b: 2 });
            const callback = vi.fn();

            watch(() => state.a + state.b, callback);
            callback.mockClear();

            state.a = 10;
            expect(callback).toHaveBeenCalledWith(12, 3);
        });
    });

    describe('equals', () => {
        it('skips the callback while equals reports the same value', () => {
            const state = createReactive({ n: 0 });
            const callback = vi.fn();
            watch(() => ({ even: state.n % 2 === 0 }), callback, {
                equals: shallow,
            });

            state.n = 2;
            expect(callback).not.toHaveBeenCalled();

            state.n = 3;
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(
                { even: false },
                { even: true },
            );
        });

        it('lets an in-place mutation through when equals says unequal', () => {
            const state = createReactive({ list: [1] });
            const byIdentity = vi.fn();
            const always = vi.fn();
            watch(() => state.list, byIdentity);
            watch(() => state.list, always, { equals: () => false });

            state.list.push(2);

            expect(byIdentity).not.toHaveBeenCalled();
            expect(always).toHaveBeenCalledTimes(1);
        });

        it('is not consulted with deep', () => {
            const state = createReactive({ nested: { n: 0 } });
            const equals = vi.fn(() => true);
            const callback = vi.fn();
            watch(() => state.nested, callback, { deep: true, equals });

            state.nested.n = 1;

            expect(callback).toHaveBeenCalledTimes(1);
            expect(equals).not.toHaveBeenCalled();
        });
    });

    describe('return value & disposal', () => {
        it('should return a stop function', () => {
            const state = createReactive({ count: 0 });
            const stop = watch(() => state.count, vi.fn());
            expect(typeof stop).toBe('function');
        });

        it('should stop watching after calling returned stop function', () => {
            const state = createReactive({ count: 0 });
            const callback = vi.fn();
            const stop = watch(() => state.count, callback);
            callback.mockClear();

            stop();

            state.count = 99;
            expect(callback).not.toHaveBeenCalled();
        });

        it('stop() should be idempotent', () => {
            const state = createReactive({ count: 0 });
            const stop = watch(() => state.count, vi.fn());
            stop();
            expect(() => stop()).not.toThrow();
        });
    });
});
