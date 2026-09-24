/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import v8 from 'node:v8';
import vm from 'node:vm';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { defineStore } from '@quantajs/core';
import { useLocalStore } from '../hooks/useCreateStore';

v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc') as () => void;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('useLocalStore', () => {
    it('lets the store be collected after the component unmounts', async () => {
        const useCounter = defineStore('memory_local', {
            state: () => ({ count: 0 }),
            actions: {
                inc() {
                    this.count++;
                },
            },
        });
        let storeRef!: WeakRef<object>;

        function Counter() {
            const store = useLocalStore(useCounter);
            storeRef ??= new WeakRef(store);
            return <span>{store.count}</span>;
        }

        const host = document.createElement('div');
        const root = createRoot(host);
        await act(async () => root.render(<Counter />));
        await act(async () => root.unmount());

        // Disposal waits a tick, to survive StrictMode's simulated unmount.
        for (let round = 0; round < 10 && storeRef.deref(); round++) {
            await sleep(0);
            gc();
        }
        expect(storeRef.deref()).toBeUndefined();
    });
});
