/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { createStore } from '@quantajs/core';

let storeId = 0;
function uniqueName(prefix = 'provider') {
    return `${prefix}_${++storeId}_${Date.now()}`;
}

describe('QuantaProvider', () => {
    let QuantaProvider: any;
    let useQuantaContext: any;

    beforeEach(async () => {
        const providerMod = await import('../components/QuantaProvider');
        QuantaProvider = providerMod.QuantaProvider;
        const contextMod = await import('../context/QuantaContext');
        useQuantaContext = contextMod.useQuantaContext;
    });

    it('should provide stores to context', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ value: 1 }),
        });

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QuantaProvider,
                { stores: { [name]: store } },
                children,
            );

        const { result } = renderHook(() => useQuantaContext(), { wrapper });
        expect(result.current.stores[name]).toBe(store);
    });

    it('should provide multiple stores', () => {
        const name1 = uniqueName();
        const name2 = uniqueName();
        const store1 = createStore(name1, { state: () => ({ a: 1 }) });
        const store2 = createStore(name2, { state: () => ({ b: 2 }) });

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QuantaProvider,
                {
                    stores: { [name1]: store1, [name2]: store2 },
                },
                children,
            );

        const { result } = renderHook(() => useQuantaContext(), { wrapper });
        expect(result.current.stores[name1]).toBe(store1);
        expect(result.current.stores[name2]).toBe(store2);
    });

    it('should throw for invalid stores prop', () => {
        expect(() => {
            renderHook(() => null, {
                wrapper: ({ children }: { children: React.ReactNode }) =>
                    React.createElement(
                        QuantaProvider,
                        {
                            stores: null as any,
                        },
                        children,
                    ),
            });
        }).toThrow(/Invalid stores/);
    });

    it('should throw for invalid store entry', () => {
        expect(() => {
            renderHook(() => null, {
                wrapper: ({ children }: { children: React.ReactNode }) =>
                    React.createElement(
                        QuantaProvider,
                        {
                            stores: { broken: null as any },
                        },
                        children,
                    ),
            });
        }).toThrow(/Invalid store "broken"/);
    });
});

describe('QuantaContext', () => {
    let useQuantaContext: any;

    beforeEach(async () => {
        const mod = await import('../context/QuantaContext');
        useQuantaContext = mod.useQuantaContext;
    });

    it('should throw when used outside QuantaProvider', () => {
        expect(() => {
            renderHook(() => useQuantaContext());
        }).toThrow(/QuantaProvider/);
    });
});
