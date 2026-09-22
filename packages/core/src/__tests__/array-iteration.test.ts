import { describe, it, expect, vi } from 'vitest';
import {
    reactive,
    readonly,
    shallowReactive,
    isReactive,
    isReadonly,
} from '../state/reactive';
import computed from '../state/computed';
import { effect } from '../core/effect';
import { createContainer } from '../core/container';
import { defineStore } from '../core/define-store';
import { logger } from '../services/logger-service';

interface Todo {
    id: number;
    done: boolean;
}
const todos = (): Todo[] => [
    { id: 1, done: false },
    { id: 2, done: true },
    { id: 3, done: false },
];

describe('array iteration methods stay reactive', () => {
    const cases: Array<[string, (items: Todo[]) => unknown]> = [
        ['map', (items) => items.map((t) => t.done)],
        ['filter', (items) => items.filter((t) => t.done).length],
        ['reduce', (items) => items.reduce((n, t) => n + (t.done ? 1 : 0), 0)],
        [
            'reduce (no initial value)',
            (items) =>
                items.map((t) => (t.done ? 1 : 0)).reduce((a, b) => a + b),
        ],
        ['find', (items) => items.find((t) => t.done)?.id],
        ['findIndex', (items) => items.findIndex((t) => t.done)],
        ['some', (items) => items.some((t) => t.done)],
        ['every', (items) => items.every((t) => t.done)],
        [
            'forEach',
            (items) => {
                let n = 0;
                items.forEach((t) => (n += t.done ? 1 : 0));
                return n;
            },
        ],
        [
            'for...of',
            (items) => {
                let n = 0;
                for (const t of items) n += t.done ? 1 : 0;
                return n;
            },
        ],
        ['spread', (items) => [...items].filter((t) => t.done).length],
        [
            'entries',
            (items) => [...items.entries()].map(([i, t]) => `${i}:${t.done}`),
        ],
    ];

    for (const [name, read] of cases) {
        it(`${name}: recomputes on every kind of change`, () => {
            const state = reactive({ items: todos() });
            const derived = computed(() => JSON.stringify(read(state.items)));
            const expected = () => JSON.stringify(read(state.items.slice()));

            const check = () => expect(derived.value).toBe(expected());
            check();
            state.items[0].done = true; // nested change
            check();
            state.items[1] = { id: 9, done: false }; // replace an item
            check();
            state.items.push({ id: 4, done: true }); // add
            check();
            state.items.splice(0, 1); // remove
            check();
            state.items.length = 1; // truncate
            check();
        });
    }

    it('includes / indexOf find both raw and reactive items', () => {
        const first = { id: 1, done: false };
        const state = reactive({ items: [first] });
        const proxy = state.items[0];

        expect(state.items.includes(first)).toBe(true);
        expect(state.items.includes(proxy)).toBe(true);
        expect(state.items.indexOf(proxy)).toBe(0);
        expect(state.items.lastIndexOf(first)).toBe(0);

        const has = computed(() => state.items.includes(first));
        expect(has.value).toBe(true);
        state.items.pop();
        expect(has.value).toBe(false);
    });
});

describe('items passed to callbacks', () => {
    it('are reactive, and so are filter/find results', () => {
        const state = reactive({ items: todos() });

        state.items.forEach((t) => expect(isReactive(t)).toBe(true));
        expect(isReactive(state.items.find((t) => t.id === 2))).toBe(true);
        for (const t of state.items.filter(() => true)) {
            expect(isReactive(t)).toBe(true);
        }
    });

    it('bubble writes made through them to the store', () => {
        const store = defineStore('array_bubble', {
            state: () => ({ items: todos() }),
        })(createContainer());
        const calls = vi.fn();
        store.subscribe(calls);

        // Reached only through forEach, never through an index read.
        store.items.forEach((t) => {
            if (t.id === 3) t.done = true;
        });

        expect(calls).toHaveBeenCalledTimes(1);
        expect(store.state.items[2].done).toBe(true);
    });

    it('are readonly for a readonly array and raw for a shallow one', () => {
        vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const ro = readonly({ items: todos() });
        ro.items.forEach((t) => expect(isReadonly(t)).toBe(true));

        const raw = todos();
        const shallow = shallowReactive(raw);
        shallow.forEach((t, i) => expect(t).toBe(raw[i]));
        vi.restoreAllMocks();
    });
});

describe('notifications for array writes', () => {
    it('run an iterating effect once per write', () => {
        const state = reactive({ items: todos() });
        let runs = 0;
        effect(() => {
            runs++;
            state.items.map((t) => t.id);
        });

        runs = 0;
        state.items[0] = { id: 7, done: false };
        expect(runs).toBe(1);

        runs = 0;
        state.items.push({ id: 8, done: false });
        expect(runs).toBe(1);
    });

    it('notify a store subscriber once per write', () => {
        const store = defineStore('array_once', {
            state: () => ({ items: todos() }),
        })(createContainer());
        const calls = vi.fn();
        void store.items.map((t) => t.id);
        store.subscribe(calls);

        store.items[0] = { id: 7, done: false };

        expect(calls).toHaveBeenCalledTimes(1);
    });
});
