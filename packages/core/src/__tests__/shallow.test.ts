import { describe, it, expect } from 'vitest';
import { shallow } from '../utils/shallow';

describe('shallow', () => {
    it('compares primitives with Object.is', () => {
        expect(shallow(1, 1)).toBe(true);
        expect(shallow(NaN, NaN)).toBe(true);
        expect(shallow(0, -0)).toBe(false);
        expect(shallow('a', 'b')).toBe(false);
    });

    it('matches objects with the same keys and identical values', () => {
        const shared = { deep: 1 };
        expect(shallow({ a: 1, b: shared }, { a: 1, b: shared })).toBe(true);
        expect(shallow({ a: 1 }, { a: 2 })).toBe(false);
        expect(shallow({ a: 1 }, { a: 1, b: 2 })).toBe(false);
        expect(shallow({ a: undefined }, { b: undefined })).toBe(false);
    });

    it('compares one level only', () => {
        expect(shallow({ a: { deep: 1 } }, { a: { deep: 1 } })).toBe(false);
    });

    it('compares arrays element by element and never equal to objects', () => {
        expect(shallow([1, 2], [1, 2])).toBe(true);
        expect(shallow([1, 2], [2, 1])).toBe(false);
        expect(shallow([1], { 0: 1 })).toBe(false);
    });

    it('treats null as a value, not an object', () => {
        expect(shallow(null, null)).toBe(true);
        expect(shallow(null, {})).toBe(false);
    });
});
