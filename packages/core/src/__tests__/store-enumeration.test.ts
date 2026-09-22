import { describe, it, expect } from 'vitest';
import { createContainer } from '../core/container';
import { defineStore } from '../core/define-store';

let uid = 0;
const build = () =>
    defineStore(`enum_${++uid}`, {
        state: () => ({ count: 1, user: { name: 'ada' } }),
        getters: { doubled: (s) => s.count * 2 },
        actions: {
            inc() {
                this.count++;
            },
        },
    })(createContainer());

describe('store enumeration', () => {
    it('Object.keys() lists state, getters and actions only', () => {
        expect(Object.keys(build())).toEqual([
            'count',
            'user',
            'doubled',
            'inc',
        ]);
    });

    it('spreads state and getter values without the store API', () => {
        const store = build();
        const { inc, ...data } = { ...store };

        expect(data).toEqual({ count: 1, user: { name: 'ada' }, doubled: 2 });
        expect(typeof inc).toBe('function');
    });

    it('JSON.stringify() serialises the state', () => {
        const store = build();
        store.inc();

        expect(JSON.parse(JSON.stringify(store))).toEqual({
            count: 2,
            user: { name: 'ada' },
        });
    });

    it('keeps the API reachable', () => {
        const store = build();

        expect('$patch' in store).toBe(true);
        expect(Reflect.ownKeys(store)).toContain('$patch');
        expect(typeof store.$patch).toBe('function');
    });
});
