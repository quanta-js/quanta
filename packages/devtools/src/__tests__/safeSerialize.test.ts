/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { safeSerialize, safeSerializeCompact } from '../utils/safeSerialize';

describe('safeSerialize', () => {
    it('handles circular references safely', () => {
        const value: Record<string, unknown> = { a: 1 };
        value.self = value;

        const serialized = safeSerialize(value);
        expect(serialized).toContain('[Circular Reference]');
    });

    it('caps depth and length', () => {
        const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
        const serialized = safeSerialize(deep, 3, 20);

        expect(serialized).toContain('[Max Depth Reached]');
    });

    it('serializes Date and RegExp', () => {
        const serialized = safeSerialize({
            date: new Date('2024-01-01'),
            re: /abc/i,
        });
        expect(serialized).toContain('2024-01-01');
        expect(serialized).toContain('/abc/i');
    });

    it('handles undefined and symbol fallback values', () => {
        const serialized = safeSerialize({
            undef: undefined,
            sym: Symbol.for('s'),
        });
        expect(serialized).toContain('[undefined]');
        expect(serialized).toContain('[symbol]');
    });

    it('enforces max length limit', () => {
        const serialized = safeSerialize(
            {
                a: 'this is a very long string',
                b: 'another long string',
            },
            10,
            5,
        );
        expect(serialized).toContain('[Max Length Exceeded]');
    });
});

describe('safeSerializeCompact', () => {
    it('handles circular references and functions', () => {
        const value: Record<string, unknown> = {
            fn: () => 'ok',
        };
        value.self = value;

        const serialized = safeSerializeCompact(value);
        expect(serialized).toContain('[Function]');
        expect(serialized).toContain('[Circular]');
    });

    it('returns fallback marker when stringify fails', () => {
        const bad: any = {
            toJSON() {
                throw new Error('nope');
            },
        };

        expect(safeSerializeCompact(bad)).toContain('[Function]');
    });

    it('serializes arrays and nested objects with depth cap', () => {
        const data = {
            list: [1, { deep: { deeper: { tooDeep: true } } }],
        };
        const serialized = safeSerializeCompact(data);
        expect(serialized).toContain('list');
    });

    it('falls back to string conversion for unsupported primitives', () => {
        const serialized = safeSerializeCompact({ value: 10n });
        expect(serialized).toContain('"10"');
    });
});

describe('safeSerialize edge cases', () => {
    it('preserves primitives, null, and undefined markers', () => {
        expect(safeSerialize(null)).toBe('null');
        expect(safeSerialize(undefined)).toBe('"[undefined]"');
        expect(
            JSON.parse(
                safeSerialize({
                    text: 'hello',
                    count: 0,
                    enabled: false,
                    missing: undefined,
                }),
            ),
        ).toEqual({
            text: 'hello',
            count: 0,
            enabled: false,
            missing: '[undefined]',
        });
    });

    it('distinguishes named and anonymous functions and symbols', () => {
        function namedHandler() {
            return true;
        }
        const unnamed = function () {};
        Object.defineProperty(unnamed, 'name', { value: '' });

        expect(
            JSON.parse(
                safeSerialize({
                    named: namedHandler,
                    unnamed,
                    symbol: Symbol.for('test'),
                    big: 42n,
                }),
            ),
        ).toEqual({
            named: '[Function: namedHandler]',
            unnamed: '[Function: anonymous]',
            symbol: '[symbol]',
            big: '[bigint]',
        });
    });

    it('serializes windows, DOM elements, and text nodes', () => {
        const plainElement = document.createElement('div');
        const identifiedElement = document.createElement('span');
        identifiedElement.id = 'result';
        const textNode = document.createTextNode('hello');
        // Vitest's injected global window does not retain the Window prototype.
        const windowInstance = Object.create(Window.prototype) as Window;

        expect(
            JSON.parse(
                safeSerialize({
                    window: windowInstance,
                    plainElement,
                    identifiedElement,
                    textNode,
                }),
            ),
        ).toEqual({
            window: '[Window]',
            plainElement: '[Element: DIV]',
            identifiedElement: '[Element: SPAN#result]',
            textNode: '[DOM Node]',
        });
    });

    it('handles circular arrays and repeated references', () => {
        const circular: unknown[] = [];
        circular.push(circular);
        const shared = { value: 'ok' };

        expect(
            JSON.parse(
                safeSerialize({ circular, first: shared, second: shared }),
            ),
        ).toEqual({
            circular: ['[Circular Reference]'],
            first: { value: 'ok' },
            second: { value: 'ok' },
        });
    });

    it('skips inherited enumerable properties', () => {
        const object = Object.create({ inherited: 'skip' });
        object.own = 'keep';

        expect(JSON.parse(safeSerialize(object))).toEqual({ own: 'keep' });
    });

    it('marks a sibling as exceeding the length limit', () => {
        expect(
            JSON.parse(
                safeSerialize({ first: 'long', second: 'short' }, 10, 1),
            ),
        ).toEqual({ first: 'long', second: '[Max Length Exceeded]' });
    });

    it('reports thrown getters and non-Error failures', () => {
        const throwsError = {
            get bad() {
                throw new Error('getter failed');
            },
        };
        const throwsString = {
            get bad() {
                throw 'unusual failure';
            },
        };

        expect(safeSerialize(throwsError)).toBe(
            '[Serialization Error: getter failed]',
        );
        expect(safeSerialize(throwsString)).toBe(
            '[Serialization Error: Unknown]',
        );
    });

    it('reports invalid dates that cannot be converted to ISO strings', () => {
        expect(safeSerialize(new Date('not a date'))).toContain(
            '[Serialization Error: Invalid time value]',
        );
    });
});

describe('safeSerializeCompact edge cases', () => {
    it('handles null, undefined, and omitted object values', () => {
        expect(safeSerializeCompact(null)).toBe('null');
        expect(safeSerializeCompact(undefined)).toBeUndefined();
        expect(
            JSON.parse(
                safeSerializeCompact({ empty: undefined, enabled: true }),
            ),
        ).toEqual({ enabled: true });
    });

    it('serializes primitives, functions, symbols, and bigint values', () => {
        function namedHandler() {
            return true;
        }
        const unnamed = function () {};
        Object.defineProperty(unnamed, 'name', { value: '' });

        expect(
            JSON.parse(
                safeSerializeCompact({
                    text: 'hello',
                    count: 7,
                    enabled: false,
                    namedHandler,
                    unnamed,
                    symbol: Symbol.for('test'),
                    big: 42n,
                }),
            ),
        ).toEqual({
            text: 'hello',
            count: 7,
            enabled: false,
            namedHandler: '[Function]',
            unnamed: '[Function]',
            symbol: 'Symbol(test)',
            big: '42',
        });
    });

    it('serializes Window, DOM nodes, and DOM elements', () => {
        const element = document.createElement('div');
        element.id = 'target';
        const textNode = document.createTextNode('hello');
        const windowInstance = Object.create(Window.prototype) as Window;

        expect(
            JSON.parse(
                safeSerializeCompact({
                    window: windowInstance,
                    element,
                    textNode,
                }),
            ),
        ).toEqual({
            window: '[Window]',
            element: '[Element]',
            textNode: '[Element]',
        });
    });

    it('handles circular arrays and repeated non-circular references', () => {
        const circular: unknown[] = [];
        circular.push(circular);
        const shared = { value: 3 };

        expect(
            JSON.parse(
                safeSerializeCompact({
                    circular,
                    one: shared,
                    two: shared,
                }),
            ),
        ).toEqual({
            circular: ['[Circular]'],
            one: { value: 3 },
            two: { value: 3 },
        });
    });

    it('skips inherited enumerable keys', () => {
        const object = Object.create({ inherited: 'skip' });
        object.own = 'keep';

        expect(JSON.parse(safeSerializeCompact(object))).toEqual({
            own: 'keep',
        });
    });

    it('serializes Date and RegExp values', () => {
        expect(
            JSON.parse(
                safeSerializeCompact({
                    date: new Date('2024-01-01T00:00:00.000Z'),
                    regexp: /example/gi,
                }),
            ),
        ).toEqual({
            date: '2024-01-01T00:00:00.000Z',
            regexp: '/example/gi',
        });
    });

    it('stops traversing deeply nested objects', () => {
        const nested: { next?: unknown } = {};
        let current = nested;

        for (let i = 0; i < 12; i++) {
            const next: { next?: unknown } = {};
            current.next = next;
            current = next;
        }

        expect(safeSerializeCompact(nested)).toContain('[...]');
    });

    it('returns the fallback marker for getters and invalid dates', () => {
        const throws = {
            get value() {
                throw new Error('getter failed');
            },
        };

        expect(safeSerializeCompact(throws)).toBe('[Error]');
        expect(safeSerializeCompact(new Date('not a date'))).toBe('[Error]');
    });
});
