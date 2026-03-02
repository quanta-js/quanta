import { createStore, watch } from './packages/core/src/index';

const cartStore = createStore('cart', {
    state: () => ({ items: [] as Array<any>, cartTotal: 0 }),
    actions: {
        addItem(this: any, product: any) {
            const existing = this.items.find((item: any) => item.id === product.id);
            if (existing) {
                existing.quantity += 1;
            } else {
                this.items = [...this.items, { ...product, quantity: 1 }];
            }
            this.cartTotal = this.items.reduce((total: number, item: any) => total + item.price * item.quantity, 0);
        }
    }
});

let renderCount = 0;
watch(() => JSON.stringify(cartStore.items), () => { renderCount++; });
watch(() => cartStore.cartTotal, () => { });

console.log("Adding items...");
for (let i = 0; i < 50; i++) {
    const start = performance.now();
    cartStore.addItem({ id: "p1", name: "Widget", price: 100 });
    console.log(`Add ${i} took ${performance.now() - start}ms (renders: ${renderCount})`);
}
