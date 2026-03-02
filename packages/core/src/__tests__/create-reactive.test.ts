import { describe, it, expect } from 'vitest';
import { createReactive } from '../core/create-reactive';
import { reactiveEffect } from '../core/effect';

describe('createReactive', () => {
    describe('basic object reactivity', () => {
        it('should create a reactive proxy for plain objects', () => {
            const obj = { a: 1, b: 'hello' };
            const reactive = createReactive(obj);
            expect(reactive.a).toBe(1);
            expect(reactive.b).toBe('hello');
        });

        it('should track property access and trigger on changes', () => {
            const obj = createReactive({ count: 0 });
            let observed = 0;

            reactiveEffect(() => {
                observed = obj.count;
            });

            expect(observed).toBe(0);
            obj.count = 5;
            expect(observed).toBe(5);
        });

        it('should not trigger when value does not change (Object.is)', () => {
            const obj = createReactive({ count: 0 });
            let callCount = 0;

            reactiveEffect(() => {
                void obj.count;
                callCount++;
            });

            expect(callCount).toBe(1);
            obj.count = 0; // same value
            expect(callCount).toBe(1);
        });

        it('should handle NaN correctly (Object.is)', () => {
            const obj = createReactive({ value: NaN });
            let callCount = 0;

            reactiveEffect(() => {
                void obj.value;
                callCount++;
            });

            expect(callCount).toBe(1);
            obj.value = NaN; // same NaN — should not trigger
            expect(callCount).toBe(1);
        });

        it('should handle deleteProperty', () => {
            const obj = createReactive({ a: 1, b: 2 } as Record<string, any>);
            let keys: string[] = [];

            reactiveEffect(() => {
                keys = Object.keys(obj);
            });

            expect(keys).toContain('a');
            delete obj.a;
            expect(keys).not.toContain('a');
        });

        it('should track "in" operator via has trap', () => {
            const obj = createReactive({ a: 1 });
            let hasA = false;

            reactiveEffect(() => {
                hasA = 'a' in obj;
            });

            expect(hasA).toBe(true);
        });

        it('should track Object.keys via ownKeys trap', () => {
            const obj = createReactive({ a: 1 } as Record<string, number>);
            let keyCount = 0;

            reactiveEffect(() => {
                keyCount = Object.keys(obj).length;
            });

            expect(keyCount).toBe(1);
        });
    });

    describe('nested reactivity', () => {
        it('should make nested objects reactive', () => {
            const obj = createReactive({ nested: { value: 1 } });
            let observed = 0;

            reactiveEffect(() => {
                observed = obj.nested.value;
            });

            expect(observed).toBe(1);
            obj.nested.value = 42;
            expect(observed).toBe(42);
        });

        it('should make deeply nested objects reactive', () => {
            const obj = createReactive({
                a: { b: { c: { d: 'deep' } } },
            });
            let observed = '';

            reactiveEffect(() => {
                observed = obj.a.b.c.d;
            });

            expect(observed).toBe('deep');
            obj.a.b.c.d = 'modified';
            expect(observed).toBe('modified');
        });

        it('should handle replacing nested object entirely', () => {
            const obj = createReactive({ nested: { value: 1 } });
            let observed = 0;

            reactiveEffect(() => {
                observed = obj.nested.value;
            });

            obj.nested = { value: 99 };
            expect(observed).toBe(99);
        });
    });

    describe('array reactivity', () => {
        it('should make arrays reactive', () => {
            const arr = createReactive([1, 2, 3]);
            let length = 0;

            reactiveEffect(() => {
                length = arr.length;
            });

            expect(length).toBe(3);
        });

        it('should intercept push and return correct value', () => {
            const arr = createReactive([1, 2]);
            const newLen = arr.push(3);
            expect(newLen).toBe(3);
            expect(arr.length).toBe(3);
        });

        it('should intercept pop and return removed element', () => {
            const arr = createReactive([1, 2, 3]);
            const removed = arr.pop();
            expect(removed).toBe(3);
            expect(arr.length).toBe(2);
        });

        it('should intercept shift and return removed element', () => {
            const arr = createReactive([10, 20, 30]);
            const removed = arr.shift();
            expect(removed).toBe(10);
        });

        it('should intercept unshift and return new length', () => {
            const arr = createReactive([2, 3]);
            const newLen = arr.unshift(1);
            expect(newLen).toBe(3);
        });

        it('should intercept splice and return removed elements', () => {
            const arr = createReactive([1, 2, 3, 4, 5]);
            const removed = arr.splice(1, 2);
            expect(removed).toEqual([2, 3]);
            expect(arr.length).toBe(3);
        });

        it('should intercept sort and return the array', () => {
            const arr = createReactive([3, 1, 2]);
            const result = arr.sort();
            expect(result).toEqual([1, 2, 3]);
        });

        it('should intercept reverse and return the array', () => {
            const arr = createReactive([1, 2, 3]);
            const result = arr.reverse();
            expect(result).toEqual([3, 2, 1]);
        });

        it('should trigger reactivity on array mutations', () => {
            const arr = createReactive([1, 2, 3]);
            let sum = 0;

            reactiveEffect(() => {
                sum = 0;
                for (let i = 0; i < arr.length; i++) {
                    sum += arr[i];
                }
            });

            expect(sum).toBe(6);
            arr.push(4);
            expect(sum).toBe(10);
        });

        it('should handle nested arrays', () => {
            const obj = createReactive({ items: [{ id: 1 }, { id: 2 }] });
            let firstId = 0;

            reactiveEffect(() => {
                firstId = obj.items[0]?.id ?? 0;
            });

            expect(firstId).toBe(1);
            obj.items[0].id = 99;
            expect(firstId).toBe(99);
        });
    });

    describe('Map reactivity', () => {
        it('should make Map reactive', () => {
            const map = createReactive(new Map([['key', 'value']]));
            expect(map.get('key')).toBe('value');
        });

        it('should track Map.get and trigger on Map.set', () => {
            const map = createReactive(new Map<string, number>());
            let observed: number | undefined;

            reactiveEffect(() => {
                observed = map.get('count');
            });

            expect(observed).toBeUndefined();
            map.set('count', 42);
            expect(observed).toBe(42);
        });

        it('should track Map.size', () => {
            const map = createReactive(new Map<string, number>());
            let size = 0;

            reactiveEffect(() => {
                size = map.size;
            });

            expect(size).toBe(0);
            map.set('a', 1);
            expect(size).toBe(1);
        });

        it('should handle Map.delete', () => {
            const map = createReactive(new Map([['a', 1]]));
            let size = 0;

            reactiveEffect(() => {
                size = map.size;
            });

            expect(size).toBe(1);
            map.delete('a');
            expect(size).toBe(0);
        });

        it('should handle Map.clear', () => {
            const map = createReactive(
                new Map([
                    ['a', 1],
                    ['b', 2],
                ]),
            );
            let size = 0;

            reactiveEffect(() => {
                size = map.size;
            });

            expect(size).toBe(2);
            map.clear();
            expect(size).toBe(0);
        });
    });

    describe('Set reactivity', () => {
        it('should make Set reactive', () => {
            const set = createReactive(new Set([1, 2, 3]));
            let size = 0;

            reactiveEffect(() => {
                size = set.size;
            });

            expect(size).toBe(3);
        });

        it('should track Set.add', () => {
            const set = createReactive(new Set<number>());
            let size = 0;

            reactiveEffect(() => {
                size = set.size;
            });

            expect(size).toBe(0);
            set.add(1);
            expect(size).toBe(1);
        });

        it('should track Set.delete', () => {
            const set = createReactive(new Set([1, 2]));
            let size = 0;

            reactiveEffect(() => {
                size = set.size;
            });

            expect(size).toBe(2);
            set.delete(1);
            expect(size).toBe(1);
        });
    });

    describe('proxy cache', () => {
        it('should return same proxy for same target', () => {
            const target = { a: 1 };
            const proxy1 = createReactive(target);
            const proxy2 = createReactive(target);
            expect(proxy1).toBe(proxy2);
        });

        it('should still be usable when wrapping a proxy', () => {
            const target = { a: 1 };
            const proxy1 = createReactive(target);
            const proxy2 = createReactive(proxy1);
            // The nested proxy should still work correctly
            expect(proxy2.a).toBe(1);
        });
    });

    describe('input validation guards', () => {
        it('should return primitives as-is', () => {
            expect(createReactive(42)).toBe(42);
            expect(createReactive('hello')).toBe('hello');
            expect(createReactive(true)).toBe(true);
            expect(createReactive(Symbol.for('test'))).toBe(Symbol.for('test'));
        });

        it('should return null and undefined as-is', () => {
            expect(createReactive(null)).toBe(null);
            expect(createReactive(undefined)).toBe(undefined);
        });

        it('should return Date instances as-is', () => {
            const date = new Date();
            expect(createReactive(date)).toBe(date);
        });

        it('should return RegExp instances as-is', () => {
            const regex = /test/;
            expect(createReactive(regex)).toBe(regex);
        });

        it('should return Error instances as-is', () => {
            const error = new Error('test');
            expect(createReactive(error)).toBe(error);
        });

        it('should return Promise instances as-is', () => {
            const promise = Promise.resolve(42);
            expect(createReactive(promise)).toBe(promise);
        });
    });
});
