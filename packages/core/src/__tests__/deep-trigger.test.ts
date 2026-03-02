import { describe, it, expect, vi } from 'vitest';
import {
    parentMap,
    setParent,
    bubbleTrigger,
    getParentChain,
} from '../utils/deep-trigger';
import { Dependency } from '../core/dependency';

describe('deep-trigger utils', () => {
    describe('setParent', () => {
        it('should set parent mapping for child object', () => {
            const child = {};
            const parent = {};
            setParent(child, parent, 'key');

            expect(parentMap.has(child)).toBe(true);
            expect(parentMap.get(child)).toEqual({ parent, key: 'key' });
        });

        it('should update parent mapping when called again', () => {
            const child = {};
            const parent1 = {};
            const parent2 = {};

            setParent(child, parent1, 'a');
            setParent(child, parent2, 'b');

            expect(parentMap.get(child)).toEqual({ parent: parent2, key: 'b' });
        });
    });

    describe('bubbleTrigger', () => {
        it('should notify parent dependencies', () => {
            const child = {};
            const parent = {};
            const dep = new Dependency();
            const callback = vi.fn();
            dep.depend(callback);

            const targetMap = new WeakMap<
                object,
                Map<string | symbol, Dependency>
            >();
            targetMap.set(parent, new Map([['childKey', dep]]));

            setParent(child, parent, 'childKey');
            bubbleTrigger(child, 'someProp', targetMap);

            expect(callback).toHaveBeenCalled();
        });

        it('should guard against cycles', () => {
            const obj = {};
            setParent(obj, obj, 'self'); // self-reference

            const targetMap = new WeakMap();
            // Should not infinite loop
            expect(() => bubbleTrigger(obj, 'prop', targetMap)).not.toThrow();
        });
    });

    describe('getParentChain', () => {
        it('should return empty chain for root objects', () => {
            const root = {};
            const chain = getParentChain(root);
            expect(chain).toEqual([]);
        });

        it('should return parent chain in order', () => {
            const root = {};
            const middle = {};
            const leaf = {};

            setParent(middle, root, 'mid');
            setParent(leaf, middle, 'leaf');

            const chain = getParentChain(leaf);
            expect(chain).toHaveLength(2);
            expect(chain[0].key).toBe('mid');
            expect(chain[1].key).toBe('leaf');
        });
    });
});
