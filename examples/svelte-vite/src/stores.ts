import { defineStore } from '@quantajs/core';

export interface Todo {
    id: number;
    text: string;
    done: boolean;
}

export const useTodos = defineStore('todos', {
    state: () => ({ owner: '', items: [] as Todo[] }),
    getters: {
        remaining: (s) => s.items.filter((t) => !t.done).length,
    },
    actions: {
        add(text: string) {
            this.items.push({ id: this.items.length + 1, text, done: false });
        },
        toggle(id: number) {
            const todo = this.items.find((t) => t.id === id);
            if (todo) todo.done = !todo.done;
        },
        /** Stands in for a request; the server awaits it before rendering. */
        async load(owner: string, delay = 0) {
            this.owner = owner;
            await new Promise((resolve) => setTimeout(resolve, delay));
            this.items = [
                { id: 1, text: `${owner}: write the docs`, done: false },
                { id: 2, text: `${owner}: ship 3.0`, done: true },
            ];
        },
    },
});

export const useCounter = defineStore('counter', {
    state: () => ({ count: 0 }),
    actions: {
        inc() {
            this.count++;
        },
    },
});
