import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    reactive,
    readonly,
    shallowReactive,
    shallowReadonly,
    isReadonly,
    isReactive,
    markRaw,
} from '../state/reactive';
import { effect } from '../core/effect';
import { logger } from '../services/logger-service';

afterEach(() => {
    vi.restoreAllMocks();
});

const quiet = () => vi.spyOn(logger, 'warn').mockImplementation(() => {});

describe('proxy cache per flag combination', () => {
    it('readonly() after shallowReadonly() is still deep', () => {
        quiet();
        const raw = { user: { name: 'ada' } };
        const shallow = shallowReadonly(raw);
        const deep = readonly(raw);

        expect(deep).not.toBe(shallow);
        expect(shallow.user).toBe(raw.user);
        expect(isReadonly(deep.user)).toBe(true);

        (deep.user as { name: string }).name = 'mallory';
        expect(raw.user.name).toBe('ada');
    });

    it('shallowReadonly() after readonly() is still shallow', () => {
        const raw = { user: { name: 'ada' } };
        const deep = readonly(raw);
        const shallow = shallowReadonly(raw);

        expect(shallow).not.toBe(deep);
        expect(shallow.user).toBe(raw.user);
        expect(isReadonly(deep.user)).toBe(true);
    });

    it('reactive() and shallowReactive() on the same object differ', () => {
        const raw = { nested: { n: 1 } };
        const shallow = shallowReactive(raw);
        const deep = reactive(raw);

        expect(deep).not.toBe(shallow);
        expect(shallow.nested).toBe(raw.nested);
        expect(isReactive(deep.nested)).toBe(true);
    });

    it('reactive(map) after shallowReactive(map) is still deep', () => {
        const value = { n: 1 };
        const map = new Map([['a', value]]);
        const shallow = shallowReactive(map);
        const deep = reactive(map);

        expect(deep).not.toBe(shallow);
        expect(shallow.get('a')).toBe(value);
        expect(isReactive(deep.get('a'))).toBe(true);
    });

    it('returns the same proxy for repeated calls with the same flags', () => {
        const raw = { a: 1 };
        expect(readonly(raw)).toBe(readonly(raw));
        expect(shallowReadonly(raw)).toBe(shallowReadonly(raw));
    });
});

describe('readonly() of a reactive proxy', () => {
    it('blocks writes at every depth', () => {
        quiet();
        const state = reactive({ a: 1, nested: { b: 1 } });
        const view = readonly(state);

        expect(isReadonly(view)).toBe(true);
        (view as { a: number }).a = 99;
        (view.nested as { b: number }).b = 99;

        expect(state.a).toBe(1);
        expect(state.nested.b).toBe(1);
    });

    it('stays reactive to writes made through the original proxy', () => {
        const state = reactive({ count: 0, nested: { v: 0 } });
        const view = readonly(state);
        const seen: number[] = [];

        effect(() => {
            seen.push(view.count + view.nested.v);
        });
        state.count = 1;
        state.nested.v = 10;

        expect(seen).toEqual([0, 1, 11]);
    });

    it('blocks writes on a readonly view of a reactive Map', () => {
        quiet();
        const map = reactive(new Map([['a', 1]]));
        const view = readonly(map);

        view.set('a', 2);
        expect(map.get('a')).toBe(1);
    });

    it('returns an existing readonly proxy unchanged', () => {
        const view = readonly({ a: 1 });
        expect(readonly(view)).toBe(view);
    });
});

describe('non-extensible objects', () => {
    it('reactive() returns a frozen object as-is', () => {
        const frozen = Object.freeze({ nested: { v: 1 } });
        const result = reactive(frozen);

        expect(result).toBe(frozen);
        expect(() => result.nested.v).not.toThrow();
    });

    it('a frozen value nested in reactive state reads without throwing', () => {
        const config = Object.freeze({ nested: { v: 1 } });
        const state = reactive({ config });

        expect(state.config).toBe(config);
        expect(state.config.nested.v).toBe(1);
    });

    it('markRaw() accepts a frozen object', () => {
        const frozen = Object.freeze({ a: 1 });
        expect(() => markRaw(frozen)).not.toThrow();
        expect(markRaw(frozen)).toBe(frozen);
    });
});
