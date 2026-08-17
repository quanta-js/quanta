/**
 * @vitest-environment happy-dom
 *
 * Regression tests for the React binding.
 *
 * Each block corresponds to a defect that shipped in 2.0.0. They drive real
 * components through `render`/`act` rather than asserting on internals,
 * because every one of these bugs lived at the boundary between the reactive
 * core and React and was invisible to unit tests of either side alone.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StrictMode, useState } from 'react';
import { render, act, screen, cleanup } from '@testing-library/react';
import { createStore, destroyAllStores } from '@quantajs/core';
import {
    useQuantaSelector,
    useQuantaStore,
    shallow,
} from '../hooks/useQuantaStore';
import { useComputed } from '../hooks/useComputed';

let uid = 0;
const name = (prefix: string) => `sel_${prefix}_${++uid}_${Date.now()}`;

afterEach(() => {
    cleanup();
    destroyAllStores();
});

describe('useQuantaSelector', () => {
    /**
     * The headline 2.0.0 bug. A selector returning a reactive array returns the
     * same proxy identity before and after an in-place mutation, so an
     * `Object.is` comparison reported "unchanged" and the component silently
     * rendered stale data. Tracking the selector's reads instead of comparing
     * its result makes identity irrelevant.
     */
    it('re-renders when a selected reactive array is mutated in place', () => {
        const store = createStore(name('array'), {
            state: () => ({ todos: [{ id: 1 }] }),
        });
        const flat = store as unknown as { todos: Array<{ id: number }> };

        const Component = () => {
            const todos = useQuantaSelector(
                store,
                (s) => (s as unknown as typeof flat).todos,
            );
            return <div data-testid="len">{todos.length}</div>;
        };

        render(<Component />);
        expect(screen.getByTestId('len').textContent).toBe('1');

        act(() => {
            flat.todos.push({ id: 2 });
        });
        expect(screen.getByTestId('len').textContent).toBe('2');

        act(() => {
            flat.todos.pop();
        });
        expect(screen.getByTestId('len').textContent).toBe('1');
    });

    it('re-renders when a nested property of a selected object changes', () => {
        const store = createStore(name('nested'), {
            state: () => ({ user: { profile: { name: 'ada' } } }),
        });
        const flat = store as unknown as {
            user: { profile: { name: string } };
        };

        const Component = () => {
            const user = useQuantaSelector(
                store,
                (s) => (s as unknown as typeof flat).user,
            );
            return <div data-testid="name">{user.profile.name}</div>;
        };

        render(<Component />);
        act(() => {
            flat.user.profile.name = 'grace';
        });

        expect(screen.getByTestId('name').textContent).toBe('grace');
    });

    /**
     * The mirror of the bug above: with comparison-based selection, a selector
     * that builds a fresh value re-renders on every unrelated change.
     */
    it('does not re-render for state the selector never reads', () => {
        const store = createStore(name('granular'), {
            state: () => ({ a: 0, b: 0 }),
        });
        const flat = store as unknown as { a: number; b: number };

        let renders = 0;
        const Component = () => {
            const a = useQuantaSelector(
                store,
                (s) => (s as unknown as typeof flat).a,
            );
            renders++;
            return <span>{a}</span>;
        };

        render(<Component />);
        const baseline = renders;

        act(() => {
            flat.b = 99;
        });
        expect(renders).toBe(baseline);

        act(() => {
            flat.a = 1;
        });
        expect(renders).toBe(baseline + 1);
    });

    it('does not re-render when a derived value is unchanged', () => {
        const store = createStore(name('derived'), {
            state: () => ({ items: [1, 2, 3] }),
        });
        const flat = store as unknown as { items: number[] };

        let renders = 0;
        const Component = () => {
            const count = useQuantaSelector(
                store,
                (s) => (s as unknown as typeof flat).items.length,
            );
            renders++;
            return <span>{count}</span>;
        };

        render(<Component />);
        const baseline = renders;

        act(() => {
            // Length is unchanged, so the selection is unchanged.
            flat.items[0] = 100;
        });
        expect(renders).toBe(baseline);
    });

    it('supports a shallow equality function for projected objects', () => {
        const store = createStore(name('shallow'), {
            state: () => ({ first: 'Ada', last: 'Lovelace', unrelated: 0 }),
        });
        const flat = store as unknown as {
            first: string;
            last: string;
            unrelated: number;
        };

        let renders = 0;
        const Component = () => {
            const person = useQuantaSelector(
                store,
                (s) => {
                    const t = s as unknown as typeof flat;
                    return { first: t.first, last: t.last };
                },
                { equalityFn: shallow },
            );
            renders++;
            return <span>{`${person.first} ${person.last}`}</span>;
        };

        render(<Component />);
        const baseline = renders;

        act(() => {
            // Re-assigning the same value produces an equal projection.
            flat.first = 'Ada';
        });
        expect(renders).toBe(baseline);

        act(() => {
            flat.first = 'Grace';
        });
        expect(renders).toBe(baseline + 1);
        expect(screen.getByText('Grace Lovelace')).toBeTruthy();
    });

    /**
     * An inline arrow selector is a new identity on every render. Keying the
     * subscription on it tore down and recreated the store subscription every
     * single render.
     */
    it('does not resubscribe when an inline selector is re-created', () => {
        const store = createStore(name('resub'), { state: () => ({ n: 0 }) });
        const subscribeSpy = vi.spyOn(store, 'subscribe');

        const Component = ({ tick }: { tick: number }) => {
            const n = useQuantaSelector(
                store,
                (s) => (s as unknown as { n: number }).n,
            );
            return (
                <span>
                    {n}-{tick}
                </span>
            );
        };

        const { rerender } = render(<Component tick={0} />);
        const afterMount = subscribeSpy.mock.calls.length;

        rerender(<Component tick={1} />);
        rerender(<Component tick={2} />);
        rerender(<Component tick={3} />);

        expect(subscribeSpy.mock.calls.length).toBe(afterMount);
        subscribeSpy.mockRestore();
    });

    /**
     * A selector closing over a prop reads *different state* when that prop
     * changes, so both the cached value and the tracked dependency set must be
     * rebuilt in the same render.
     */
    it('recomputes when the selector closes over changed props', () => {
        const store = createStore(name('switch'), {
            state: () => ({ count: 0, label: 'a' }),
        });
        const flat = store as unknown as { count: number; label: string };

        const Component = () => {
            const [mode, setMode] = useState<'count' | 'label'>('count');
            const value = useQuantaSelector(store, (s) => {
                const t = s as unknown as typeof flat;
                return mode === 'count' ? t.count : t.label;
            });
            return (
                <div>
                    <span data-testid="value">{String(value)}</span>
                    <button onClick={() => setMode('label')}>switch</button>
                </div>
            );
        };

        render(<Component />);
        act(() => {
            flat.count = 20;
            flat.label = 'latest';
        });
        expect(screen.getByTestId('value').textContent).toBe('20');

        act(() => {
            screen.getByText('switch').click();
        });
        expect(screen.getByTestId('value').textContent).toBe('latest');

        // ...and the new selector's dependency is now the tracked one.
        act(() => {
            flat.label = 'next';
        });
        expect(screen.getByTestId('value').textContent).toBe('next');
    });

    it('releases its effect on unmount', () => {
        const store = createStore(name('unmount'), { state: () => ({ n: 0 }) });
        const flat = store as unknown as { n: number };

        let renders = 0;
        const Component = () => {
            useQuantaSelector(store, (s) => (s as unknown as typeof flat).n);
            renders++;
            return null;
        };

        const { unmount } = render(<Component />);
        unmount();
        const baseline = renders;

        act(() => {
            flat.n = 5;
        });
        expect(renders).toBe(baseline);
    });

    it('works under StrictMode', () => {
        const store = createStore(name('strict'), { state: () => ({ n: 1 }) });
        const flat = store as unknown as { n: number };

        const Component = () => {
            const n = useQuantaSelector(
                store,
                (s) => (s as unknown as typeof flat).n,
            );
            return <div data-testid="n">{n}</div>;
        };

        render(
            <StrictMode>
                <Component />
            </StrictMode>,
        );
        act(() => {
            flat.n = 7;
        });

        expect(screen.getByTestId('n').textContent).toBe('7');
    });
});

describe('useComputed', () => {
    /**
     * StrictMode mounts, unmounts and remounts. The render body does not re-run
     * on that remount, so a hook that created its computed during render and
     * nulled the ref in the unmount cleanup was left without one — frozen at a
     * stale value, then throwing on the next read.
     */
    it('survives a StrictMode remount', () => {
        const store = createStore(name('computed-strict'), {
            state: () => ({ n: 1 }),
        });
        const flat = store as unknown as { n: number };

        const Component = () => {
            const doubled = useComputed(
                store,
                (s) => (s as unknown as typeof flat).n * 2,
            );
            return <div data-testid="d">{doubled}</div>;
        };

        render(
            <StrictMode>
                <Component />
            </StrictMode>,
        );
        expect(screen.getByTestId('d').textContent).toBe('2');

        act(() => {
            flat.n = 5;
        });
        expect(screen.getByTestId('d').textContent).toBe('10');
    });

    it('recomputes only when its dependencies change', () => {
        const store = createStore(name('computed-deps'), {
            state: () => ({ n: 1, unrelated: 0 }),
        });
        const flat = store as unknown as { n: number; unrelated: number };

        let computations = 0;
        const Component = () => {
            const doubled = useComputed(store, (s) => {
                computations++;
                return (s as unknown as typeof flat).n * 2;
            });
            return <div data-testid="d">{doubled}</div>;
        };

        render(<Component />);
        const baseline = computations;

        act(() => {
            flat.unrelated = 99;
        });
        expect(computations).toBe(baseline);

        act(() => {
            flat.n = 3;
        });
        expect(screen.getByTestId('d').textContent).toBe('6');
    });
});

describe('useQuantaStore', () => {
    it('re-renders on any store change and exposes actions', () => {
        const store = createStore(name('whole'), {
            state: () => ({ n: 0 }),
            actions: {
                inc(this: { n: number }) {
                    this.n++;
                },
            },
        });

        const Component = () => {
            const s = useQuantaStore(store) as unknown as {
                n: number;
                inc: () => void;
            };
            return (
                <button onClick={() => s.inc()} data-testid="btn">
                    {s.n}
                </button>
            );
        };

        render(<Component />);
        act(() => {
            screen.getByTestId('btn').click();
        });

        expect(screen.getByTestId('btn').textContent).toBe('1');
    });
});
