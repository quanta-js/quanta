import { describe, it, expect, vi } from 'vitest';
import watch from '../state/watch';
import { createReactive } from '../core/create-reactive';

describe('watch', () => {
    describe('basic watching', () => {
        it('should invoke callback immediately by default (immediate: true)', () => {
            const state = createReactive({ count: 0 });
            const callback = vi.fn();

            watch(() => state.count, callback);

            expect(callback).toHaveBeenCalledOnce();
            expect(callback).toHaveBeenCalledWith(0, undefined);
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

    describe('return value', () => {
        it('should return the effect function', () => {
            const state = createReactive({ count: 0 });
            const result = watch(() => state.count, vi.fn());
            expect(typeof result).toBe('function');
        });
    });
});
