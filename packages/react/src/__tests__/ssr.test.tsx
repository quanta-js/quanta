/**
 * @vitest-environment happy-dom
 *
 * Drives the dehydrate/hydrate round trip through the *real* SSR and
 * hydration APIs — `react-dom/server`'s `renderToString` and
 * `react-dom/client`'s `hydrateRoot` — rather than `@testing-library/react`'s
 * `render()`, which never produces server markup and so can't catch a
 * mismatch between what the server sent and what the client hydrates onto.
 *
 * This is the fast, framework-free complement to `examples/nextjs-app`:
 * everything here that doesn't require an actual RSC boundary or bundler,
 * covered in milliseconds instead of a `next build`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import {
    createContainer,
    defineStore,
    destroyAllStores,
    type ContainerSnapshot,
} from '@quantajs/core';
import { QuantaProvider } from '../components/QuantaProvider';
import { useQuanta } from '../hooks/useStore';

// Not going through @testing-library/react here (it sets this itself) — this
// test drives `react-dom` directly, so `act()` needs telling this *is* a
// test environment or React logs a warning on every call.
(
    globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let uid = 0;
const name = (p = 'ssr') => `${p}_${++uid}_${Date.now()}`;

afterEach(() => {
    destroyAllStores();
});

const counterDefinition = () =>
    defineStore(name('counter'), {
        state: () => ({ count: 0 }),
        getters: { doubled: (s) => s.count * 2 },
        actions: {
            increment() {
                this.count++;
            },
        },
    });

describe('SSR: renderToString -> hydrateRoot', () => {
    it('hydrates onto server-rendered markup with no mismatch and stays live', () => {
        const definition = counterDefinition();

        // --- "server" ------------------------------------------------
        const server = createContainer('ssr-server');
        const serverCounter = definition(server);
        serverCounter.increment();
        serverCounter.increment();
        serverCounter.increment();

        const App = () => {
            const counter = useQuanta(definition);
            return (
                <button data-testid="count" onClick={() => counter.increment()}>
                    {counter.count} (doubled: {counter.doubled})
                </button>
            );
        };

        const html = renderToString(
            <QuantaProvider container={server}>
                <App />
            </QuantaProvider>,
        );

        const snapshot: ContainerSnapshot = server.dehydrate();
        server.dispose();

        // --- "client" -------------------------------------------------
        // A fresh container, hydrated from the server's snapshot — exactly
        // the round trip a real app does, not a container shared by
        // reference across the boundary.
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container);

        // Read via textContent, not the raw HTML string: React separates
        // adjacent text-producing children with `<!-- -->` comments in SSR
        // output so hydration can match each one to its own text node —
        // real behavior, not a fixture detail.
        expect(container.textContent).toBe('3 (doubled: 6)');

        const errors: unknown[][] = [];
        const originalError = console.error;
        console.error = (...args: unknown[]) => {
            errors.push(args);
        };

        let root!: Root;
        try {
            act(() => {
                root = hydrateRoot(
                    container,
                    <QuantaProvider snapshot={snapshot}>
                        <App />
                    </QuantaProvider>,
                );
            });
        } finally {
            console.error = originalError;
        }

        // A hydration mismatch is exactly the class of bug this test exists
        // to catch — React reports it through console.error, not a thrown
        // exception.
        const mismatchErrors = errors.filter((args) =>
            String(args[0]).toLowerCase().includes('hydrat'),
        );
        expect(mismatchErrors).toEqual([]);

        // The value the client hydrated onto is the server's value, never a
        // flash of default state.
        const button = container.querySelector(
            '[data-testid="count"]',
        ) as HTMLButtonElement;
        expect(button.textContent).toBe('3 (doubled: 6)');

        // Hydration wires up real event handlers, not just markup — the
        // store built with `state`/`getters`/`actions` is live after the
        // round trip.
        act(() => {
            button.click();
        });
        expect(button.textContent).toBe('4 (doubled: 8)');

        act(() => {
            root.unmount();
        });
        container.remove();
    });

    it('renders default state with no server container, matching a client-only render', () => {
        const definition = counterDefinition();

        const App = () => {
            const counter = useQuanta(definition);
            return <span>{counter.count}</span>;
        };

        const html = renderToString(
            <QuantaProvider>
                <App />
            </QuantaProvider>,
        );
        expect(html).toContain('>0<');

        const container = document.createElement('div');
        document.body.appendChild(container);
        let root!: Root;
        act(() => {
            root = createRoot(container);
            root.render(
                <QuantaProvider>
                    <App />
                </QuantaProvider>,
            );
        });
        expect(container.textContent).toBe('0');

        act(() => {
            root.unmount();
        });
        container.remove();
    });
});
