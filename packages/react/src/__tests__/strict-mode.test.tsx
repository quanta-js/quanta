/**
 * @vitest-environment happy-dom
 *
 * StrictMode mounts, unmounts and remounts every component in development.
 * A container disposed by that simulated unmount must not be the one the
 * children go on using.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { defineStore, type StoreContainer } from '@quantajs/core';
import { QuantaProvider } from '../components/QuantaProvider';
import { useQuantaContext } from '../context/QuantaContext';
import { useQuanta } from '../hooks/useStore';
import { useLocalStore } from '../hooks/useCreateStore';

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

let uid = 0;
const counter = () =>
    defineStore(`strict_${++uid}`, {
        state: () => ({ count: 0 }),
        actions: {
            increment() {
                this.count++;
            },
        },
    });

describe('QuantaProvider without a container, under StrictMode', () => {
    it('keeps working after the double mount', () => {
        const def = counter();
        const Counter = () => {
            const store = useQuanta(def);
            return (
                <button onClick={() => store.increment()}>{store.count}</button>
            );
        };
        render(
            <StrictMode>
                <QuantaProvider>
                    <Counter />
                </QuantaProvider>
            </StrictMode>,
        );

        act(() => screen.getByRole('button').click());
        act(() => screen.getByRole('button').click());

        expect(screen.getByRole('button').textContent).toBe('2');
    });

    it('disposes its container after a real unmount', async () => {
        vi.useFakeTimers();
        let container: StoreContainer | null = null;
        const Probe = () => {
            container = useQuantaContext().container;
            return null;
        };
        const { unmount } = render(
            <StrictMode>
                <QuantaProvider>
                    <Probe />
                </QuantaProvider>
            </StrictMode>,
        );
        expect(container!.active).toBe(true);

        unmount();
        await vi.runAllTimersAsync();

        expect(container!.active).toBe(false);
    });
});

describe('useLocalStore under StrictMode', () => {
    it('disposes its store after a real unmount', async () => {
        vi.useFakeTimers();
        const def = counter();
        let store: ReturnType<typeof def> | null = null;
        const Probe = () => {
            store = useLocalStore(def);
            return null;
        };
        const { unmount } = render(
            <StrictMode>
                <Probe />
            </StrictMode>,
        );
        const destroy = vi.spyOn(store!, '$destroy');

        unmount();
        await vi.runAllTimersAsync();

        expect(destroy).toHaveBeenCalled();
    });
});
