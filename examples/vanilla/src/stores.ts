import { defineStore, LocalStorageAdapter } from '@quantajs/core';

/**
 * A store definition is safe to share at module scope — it holds no state
 * itself, only a name and a blueprint. State only exists once it is resolved
 * against a container.
 */
export const useCounterStore = defineStore('counter', {
    state: () => ({ count: 0 }),
    getters: {
        doubled: (s) => s.count * 2,
    },
    actions: {
        increment() {
            this.count++;
        },
        reset() {
            this.count = 0;
        },
    },
});

export interface Todo {
    id: number;
    text: string;
    done: boolean;
}

export const useTodoStore = defineStore('todos', {
    state: () => ({
        items: [] as Todo[],
        nextId: 1,
    }),
    // Survives a page reload via localStorage. The adapter is SSR-safe (it
    // degrades to a no-op when `window` doesn't exist), so this same
    // definition is safe to reuse in the SSR examples without a guard.
    persist: {
        adapter: new LocalStorageAdapter('quanta-example-todos'),
    },
    getters: {
        remaining: (s) => s.items.filter((t) => !t.done).length,
    },
    actions: {
        add(text: string) {
            this.items.push({ id: this.nextId++, text, done: false });
        },
        toggle(id: number) {
            const todo = this.items.find((t) => t.id === id);
            if (todo) todo.done = !todo.done;
        },
        /**
         * An async action: `pending` and `error` are tracked automatically and
         * are themselves reactive, so a plain `store.subscribe()` picks up the
         * loading state with no extra wiring.
         */
        async seed() {
            await new Promise((resolve) => setTimeout(resolve, 400));
            for (const text of ['Read the docs', 'Ship a container per request']) {
                this.items.push({ id: this.nextId++, text, done: false });
            }
        },
    },
});
