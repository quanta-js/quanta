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
