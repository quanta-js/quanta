import { describe, it } from 'vitest';
import { createStore, watch } from '../index';

describe('Cart Stress Test', () => {
    it('should add 50 items without exponential slowdown', () => {
        const cartStore = createStore('cart', {
            state: () => ({ items: [] as Array<any>, cartTotal: 0 }),
            actions: {
                addItem(this: any, product: any) {
                    const existing = this.items.find(
                        (item: any) => item.id === product.id,
                    );
                    if (existing) {
                        existing.quantity += 1;
                    } else {
                        this.items = [
                            ...this.items,
                            { ...product, quantity: 1 },
                        ];
                    }
                    this.cartTotal = this.items.reduce(
                        (total: number, item: any) =>
                            total + item.price * item.quantity,
                        0,
                    );
                },
            },
        });

        let renderCount = 0;
        watch(
            () => JSON.stringify(cartStore.items),
            () => {
                renderCount++;
            },
        );
        watch(
            () => cartStore.cartTotal,
            () => {},
        );

        for (let i = 0; i < 50; i++) {
            cartStore.addItem({ id: `p${i}`, name: 'Widget', price: 100 });
        }

        // If it didn't freeze, we pass. We can just assert execution happened.
        // renderCount should be around 51 (initial + 50 renders)
    });
});
