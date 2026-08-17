import { defineStore } from '../../index';

interface Item {
    id: number;
    price: number;
}

export const useCart = defineStore('cart', {
    state: () => ({ items: [] as Item[], coupon: '' }),
    getters: {
        total: (s) => s.items.reduce((n, i) => n + i.price, 0),
        count: (s) => s.items.length,
    },
    actions: {
        add(item: Item) {
            this.items.push(item);
            this.recount();
        },
        recount() {
            return this.count;
        },
        async load(id: string) {
            void id;
            void this.$signal;
            this.items = [];
        },
    },
});

const cart = useCart();
const a: number = cart.total;
const b: number = cart.count;
const c: Item[] = cart.items;
cart.add({ id: 1, price: 2 });
const d: boolean = cart.load.pending;
const e: Error | null = cart.load.error;
cart.load.abort();
const f: Promise<void> = cart.load('x');
void a;
void b;
void c;
void d;
void e;
void f;

// @ts-expect-error total is derived and readonly
cart.total = 5;
// @ts-expect-error wrong argument type
cart.add('nope');
// @ts-expect-error unknown property
void cart.doesNotExist;
