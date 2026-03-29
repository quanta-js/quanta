import { describe, it, expect } from 'vitest';
import { createStore } from '../core/create-store';

let storeId = 0;
function uniqueName() {
    return `test_async_${++storeId}_${Date.now()}`;
}

describe('async action race conditions', () => {
    it('should handle concurrent async actions without corruption', async () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ data: null as string | null, loading: false }),
            actions: {
                async fetchData(this: any, id: string, delay: number) {
                    this.loading = true;
                    // Simulate async work
                    await new Promise((r) => setTimeout(r, delay));
                    this.data = `result-${id}`;
                    this.loading = false;
                },
            },
        });

        // Fire two concurrent fetches
        // p1 takes 100ms, p2 takes 10ms
        const p1 = store.fetchData('slow', 100);
        const p2 = store.fetchData('fast', 10);

        await Promise.all([p1, p2]);

        // Last-write-wins: result depends on which resolves last.
        // Even though p2 was fired second, p1 takes longer so it resolves last.
        expect(store.loading).toBe(false);
        expect(store.data).toBe('result-slow');
    });
});
