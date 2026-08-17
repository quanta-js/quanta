/**
 * @vitest-environment happy-dom
 *
 * KNOWN DEFECTS (React adapter) — see the header of
 * packages/core/src/__tests__/known-defects.test.ts for the convention.
 *
 * Every test is the CORRECT behaviour, marked `it.fails(...)`. When a fix
 * lands the test turns red: drop `.fails` and it becomes a regression test.
 *
 * Finding IDs refer to ANALYSIS-v2.md at the repo root.
 */
import { describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, act, screen } from '@testing-library/react';
import { createStore } from '@quantajs/core';
import { useQuantaSelector, useQuantaStore } from '../hooks/useQuantaStore';
import { useComputed } from '../hooks/useComputed';

let uid = 0;
const name = (p: string) => `kdr_${p}_${++uid}_${Date.now()}`;

describe('known defects — React adapter', () => {
    /**
     * B-1 — THE headline React bug.
     *
     * useQuantaSelector compares old/new with Object.is. A selector that
     * returns a reactive object or array returns the SAME proxy identity
     * before and after an in-place mutation, so the comparison always says
     * "unchanged" and the component never re-renders.
     *
     * `useQuantaSelector(store, s => s.todos)` is the single most natural
     * thing a React developer will write, and it silently renders stale UI.
     *
     * The mirror image is equally bad: a selector that builds a new array
     * (`s => s.todos.filter(...)`) is never Object.is-equal, so it re-renders
     * on every unrelated store change. There is no equalityFn / shallow
     * option to escape either horn.
     */
    it.fails(
        'B-1: selecting a reactive array re-renders on in-place mutation',
        () => {
            const store = createStore(name('sel'), {
                state: () => ({ todos: [{ id: 1 }] }),
            });
            const s = store as unknown as { todos: Array<{ id: number }> };

            const Comp = () => {
                const todos = useQuantaSelector(
                    store as never,
                    (st: never) => (st as unknown as typeof s).todos,
                );
                return <div data-testid="len">{todos.length}</div>;
            };

            render(<Comp />);
            expect(screen.getByTestId('len').textContent).toBe('1');

            act(() => {
                s.todos.push({ id: 2 });
            });

            try {
                expect(screen.getByTestId('len').textContent).toBe('2'); // actual: '1'
            } finally {
                store.$destroy();
            }
        },
    );

    /**
     * B-8 — The `subscribe` callback passed to useSyncExternalStore is
     * memoised on [store, selector]. An inline arrow selector — the
     * documented usage — is a new identity every render, so React tears down
     * and re-creates the store subscription on EVERY render. A `selectorRef`
     * exists in the file but is not used in the dependency list.
     */
    it.fails(
        'B-8: an inline selector does not cause resubscription per render',
        () => {
            const store = createStore(name('resub'), {
                state: () => ({ n: 0 }),
            });
            const spy = vi.spyOn(store, 'subscribe');

            const Comp = () => {
                const v = useQuantaSelector(
                    store as never,
                    (st: never) => (st as unknown as { n: number }).n,
                );
                return <div>{v}</div>;
            };

            const { rerender } = render(<Comp />);
            const afterMount = spy.mock.calls.length;
            rerender(<Comp />);
            rerender(<Comp />);
            rerender(<Comp />);

            try {
                expect(spy.mock.calls.length).toBe(afterMount); // actual: afterMount + 3
            } finally {
                spy.mockRestore();
                store.$destroy();
            }
        },
    );

    /**
     * B-4 — useComputed creates the computed in the render body but disposes
     * it in an unmount cleanup that also nulls the ref. React StrictMode
     * mounts, unmounts and remounts; the render body does not re-run on
     * remount, so the ref stays null forever. The component then renders a
     * stale value and the selector throws
     * "Cannot read properties of null (reading 'value')".
     *
     * StrictMode is the default in Next.js and Create React App dev builds,
     * so this affects essentially every React developer's first experience.
     */
    it.fails('B-4: useComputed survives a StrictMode remount', () => {
        const store = createStore(name('sm'), { state: () => ({ n: 1 }) });
        const s = store as unknown as { n: number };

        const Comp = () => {
            const doubled = useComputed(
                store as never,
                (st: never) => (st as unknown as typeof s).n * 2,
            );
            return <div data-testid="d">{doubled}</div>;
        };

        render(
            <StrictMode>
                <Comp />
            </StrictMode>,
        );
        act(() => {
            s.n = 5;
        });

        try {
            expect(screen.getByTestId('d').textContent).toBe('10'); // actual: '2'
        } finally {
            store.$destroy();
        }
    });

    /**
     * B-13 — useQuantaStore subscribes to the store's single global change
     * notifier and bumps a version counter, so every consumer re-renders on
     * every change anywhere in the store. This is precisely the React Context
     * fan-out problem that developers adopt a state library to escape.
     */
    it.fails('B-13: a consumer does not re-render for unrelated state', () => {
        const store = createStore(name('fanout'), {
            state: () => ({ a: 0, b: 0 }),
        });
        const s = store as unknown as { a: number; b: number };

        let bRenders = 0;
        const A = () => {
            const st = useQuantaStore(store as never);
            return <span>{(st as unknown as typeof s).a}</span>;
        };
        const B = () => {
            const st = useQuantaStore(store as never);
            bRenders++;
            return <span>{(st as unknown as typeof s).b}</span>;
        };

        render(
            <>
                <A />
                <B />
            </>,
        );
        const before = bRenders;

        act(() => {
            s.a = 1; // B reads only `b`
        });

        try {
            expect(bRenders - before).toBe(0); // actual: 1
        } finally {
            store.$destroy();
        }
    });
});
