/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
    render,
    renderHook,
    screen,
    cleanup,
    act,
} from '@testing-library/react';
import {
    createContainer,
    defineStore,
    destroyAllStores,
    type ContainerSnapshot,
} from '@quantajs/core';
import { QuantaProvider } from '../components/QuantaProvider';
import { useQuantaContext } from '../context/QuantaContext';
import { useQuanta, useQuantaValue } from '../hooks/useStore';

let uid = 0;
const name = (p = 'provider') => `${p}_${++uid}_${Date.now()}`;

afterEach(() => {
    cleanup();
    destroyAllStores();
});

const counterDefinition = () =>
    defineStore(name('counter'), {
        state: () => ({ count: 0, label: 'default' }),
        getters: { doubled: (s) => s.count * 2 },
        actions: {
            bump() {
                this.count++;
            },
        },
    });

describe('QuantaProvider', () => {
    it('exposes the supplied container to descendants', () => {
        const container = createContainer('supplied');
        const { result } = renderHook(() => useQuantaContext(), {
            wrapper: ({ children }) => (
                <QuantaProvider container={container}>
                    {children}
                </QuantaProvider>
            ),
        });

        expect(result.current.container).toBe(container);
        container.dispose();
    });

    it('creates its own container when none is supplied', () => {
        const { result } = renderHook(() => useQuantaContext(), {
            wrapper: ({ children }) => (
                <QuantaProvider>{children}</QuantaProvider>
            ),
        });

        expect(result.current.container.active).toBe(true);
    });

    it('disposes a container it created, but not one it was given', () => {
        const supplied = createContainer('kept');
        const suppliedRun = renderHook(() => useQuantaContext(), {
            wrapper: ({ children }) => (
                <QuantaProvider container={supplied}>{children}</QuantaProvider>
            ),
        });
        suppliedRun.unmount();
        // A caller-supplied container has a lifetime the caller owns.
        expect(supplied.active).toBe(true);
        supplied.dispose();

        const ownedRun = renderHook(() => useQuantaContext(), {
            wrapper: ({ children }) => (
                <QuantaProvider>{children}</QuantaProvider>
            ),
        });
        const owned = ownedRun.result.current.container;
        ownedRun.unmount();
        expect(owned.active).toBe(false);
    });

    it('throws a helpful error outside a provider', () => {
        expect(() => renderHook(() => useQuantaContext())).toThrow(
            /must be used within a <QuantaProvider>/,
        );
    });

    it('keeps the context value stable across re-renders', () => {
        const container = createContainer('stable');
        const seen: unknown[] = [];
        const { rerender } = renderHook(
            () => {
                seen.push(useQuantaContext());
                return null;
            },
            {
                wrapper: ({ children }) => (
                    <QuantaProvider container={container}>
                        {children}
                    </QuantaProvider>
                ),
            },
        );

        rerender();
        rerender();

        // A fresh context object each render would re-render every consumer.
        expect(new Set(seen).size).toBe(1);
        container.dispose();
    });
});

describe('per-container isolation', () => {
    it('gives each container its own instance of the same definition', () => {
        const definition = counterDefinition();
        const first = createContainer('a');
        const second = createContainer('b');

        const storeA = definition(first);
        const storeB = definition(second);

        storeA.bump();
        storeA.bump();

        expect(storeA.count).toBe(2);
        expect(storeB.count).toBe(0);

        first.dispose();
        second.dispose();
    });

    it('renders two trees from two containers without cross-talk', () => {
        const definition = counterDefinition();
        const left = createContainer('left');
        const right = createContainer('right');

        const Counter = ({ testId }: { testId: string }) => {
            const count = useQuantaValue(definition, (s) => s.count);
            return <span data-testid={testId}>{count}</span>;
        };

        render(
            <>
                <QuantaProvider container={left}>
                    <Counter testId="left" />
                </QuantaProvider>
                <QuantaProvider container={right}>
                    <Counter testId="right" />
                </QuantaProvider>
            </>,
        );

        act(() => {
            definition(left).bump();
        });

        expect(screen.getByTestId('left').textContent).toBe('1');
        expect(screen.getByTestId('right').textContent).toBe('0');

        left.dispose();
        right.dispose();
    });
});

describe('SSR hydration', () => {
    it('round-trips state through dehydrate and hydrate', () => {
        const definition = counterDefinition();

        // --- "server"
        const server = createContainer('request-1');
        const serverStore = definition(server);
        serverStore.bump();
        serverStore.bump();
        serverStore.label = 'from server';
        const snapshot = server.dehydrate();
        server.dispose();

        // --- "client"
        const client = createContainer('browser');
        client.hydrate(snapshot);
        const clientStore = definition(client);

        expect(clientStore.count).toBe(2);
        expect(clientStore.label).toBe('from server');
        // Derived values recompute from hydrated state.
        expect(clientStore.doubled).toBe(4);

        client.dispose();
    });

    it('applies a snapshot to stores created after hydrate()', () => {
        // The realistic client ordering: hydrate runs before the components
        // that resolve the stores have mounted.
        const definition = counterDefinition();
        const container = createContainer('lazy');

        container.hydrate({ [definition.$id]: { count: 7, label: 'late' } });
        const store = definition(container);

        expect(store.count).toBe(7);
        expect(store.label).toBe('late');
        container.dispose();
    });

    it('hydrates through the provider before children render', () => {
        const definition = counterDefinition();
        const snapshot: ContainerSnapshot = {
            [definition.$id]: { count: 42, label: 'ssr' },
        };

        const Display = () => {
            const count = useQuantaValue(definition, (s) => s.count);
            return <span data-testid="count">{count}</span>;
        };

        render(
            <QuantaProvider snapshot={snapshot}>
                <Display />
            </QuantaProvider>,
        );

        // 42 on the very first paint — never 0 and then corrected, which is
        // what produces a hydration mismatch.
        expect(screen.getByTestId('count').textContent).toBe('42');
    });

    it('ignores malformed and unsafe snapshot entries', () => {
        const container = createContainer('hostile');
        expect(() =>
            container.hydrate({
                __proto__: { polluted: 'yes' },
                notAnObject: 'string' as never,
            } as ContainerSnapshot),
        ).not.toThrow();
        expect(({} as { polluted?: string }).polluted).toBeUndefined();
        container.dispose();
    });

    it('a disposed container refuses further work', () => {
        const definition = counterDefinition();
        const container = createContainer('disposed');
        definition(container);
        container.dispose();

        expect(container.active).toBe(false);
        expect(() => definition(container)).toThrow(/after dispose/);
        expect(() => container.hydrate({})).toThrow(/after dispose/);
        // Disposal is idempotent.
        expect(() => container.dispose()).not.toThrow();
    });
});

describe('useQuanta', () => {
    it('re-renders when the resolved store changes', () => {
        const definition = counterDefinition();
        const Component = () => {
            const store = useQuanta(definition);
            return (
                <button data-testid="btn" onClick={() => store.bump()}>
                    {store.count}
                </button>
            );
        };

        render(<Component />);
        act(() => screen.getByTestId('btn').click());

        expect(screen.getByTestId('btn').textContent).toBe('1');
    });
});
