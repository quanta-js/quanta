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
