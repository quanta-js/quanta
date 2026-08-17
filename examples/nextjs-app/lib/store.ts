import { defineStore } from '@quantajs/core';

/**
 * Safe to declare at module scope — a definition holds no state, so
 * importing it does nothing per-request. State only exists once resolved
 * against a container, which `app/page.tsx` does per request.
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
    },
});
