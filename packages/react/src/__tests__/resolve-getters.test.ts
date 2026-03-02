import { describe, it, expect } from 'vitest';
import { resolveGetterValue } from '../utils/resolve-getters';

describe('resolveGetterValue', () => {
    it('should unwrap computed-like objects with .value', () => {
        const getter = {
            get value() {
                return 42;
            },
        };
        expect(resolveGetterValue(getter, {})).toBe(42);
    });

    it('should return plain objects with value property', () => {
        const getter = { value: 'hello' };
        expect(resolveGetterValue(getter, {})).toBe('hello');
    });

    it('should bind function getters to storeRef', () => {
        const fn = function (this: any) {
            return this.x;
        };
        const storeRef = { x: 99 };
        const bound = resolveGetterValue(fn, storeRef);
        expect(typeof bound).toBe('function');
        expect(bound()).toBe(99);
    });

    it('should return primitive values as-is', () => {
        expect(resolveGetterValue(42, {})).toBe(42);
        expect(resolveGetterValue('hello', {})).toBe('hello');
        expect(resolveGetterValue(true, {})).toBe(true);
        expect(resolveGetterValue(null, {})).toBe(null);
    });

    it('should handle getter.value throwing error gracefully', () => {
        const getter = {
            get value(): never {
                throw new Error('fail');
            },
        };
        // Should fall back safely
        const result = resolveGetterValue(getter, {});
        expect(result).toBe(getter); // falls back to returning the getter itself
    });
});
