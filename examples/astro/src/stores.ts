import { defineStore } from '@quantajs/core';

/** One store, read and changed by React, Vue and Svelte islands alike. */
export const useCart = defineStore('cart', {
    state: () => ({ user: '', items: [] as string[] }),
    getters: {
        count: (s) => s.items.length,
    },
    actions: {
        add(item: string) {
            this.items.push(item);
        },
        /** Stands in for a request; pages await it in their frontmatter. */
        async load(user: string, delay = 0) {
            this.user = user;
            await new Promise((resolve) => setTimeout(resolve, delay));
            this.items = [`${user}'s first item`];
        },
    },
});
