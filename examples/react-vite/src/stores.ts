import { defineStore } from '@quantajs/core';

export interface CartItem {
    id: number;
    name: string;
    price: number;
}

let nextId = 1;

export const useCartStore = defineStore('cart', {
    state: () => ({ items: [] as CartItem[] }),
    getters: {
        total: (s) => s.items.reduce((sum, i) => sum + i.price, 0),
    },
    actions: {
        add(name: string, price: number) {
            this.items.push({ id: nextId++, name, price });
        },
        remove(id: number) {
            this.items = this.items.filter((i) => i.id !== id);
        },
        /**
         * A fake network call, abortable via `this.$signal`. Exercises the
         * three states every action carries: `pending`, `error` and
         * `abort()` — in a real component, not just a unit test.
         */
        async checkout() {
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(resolve, 1500);
                this.$signal?.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new Error('Checkout cancelled'));
                });
            });
            this.items = [];
        },
    },
});

/**
 * Given its own container per component instance by `useLocalStore` — two
 * `<Wizard>`s on screen at once do not share a step.
 */
export const useWizardStore = defineStore('wizard', {
    state: () => ({ step: 1 }),
    actions: {
        next() {
            this.step = Math.min(3, this.step + 1);
        },
        back() {
            this.step = Math.max(1, this.step - 1);
        },
    },
});
