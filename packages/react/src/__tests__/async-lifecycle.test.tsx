/**
 * @vitest-environment happy-dom
 *
 * An async action's `pending`/`error` read off a `useQuanta`-resolved store.
 *
 * These live on a reactive object separate from `state`, so they only reach a
 * component if the store's coarse change-notifier depends on them too. It
 * previously did not: a raw `effect()` reading `pending` woke correctly, but
 * `store.subscribe()` — and therefore `useQuanta` — never fired, which made a
 * loading flag appear to work only when the action also happened to write
 * state at around the same moment.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { defineStore, destroyAllStores } from '@quantajs/core';
import { useQuanta, useQuantaValue } from '../hooks/useStore';

let uid = 0;
const name = (p = 'async') => `${p}_${++uid}_${Date.now()}`;

afterEach(() => {
    cleanup();
    destroyAllStores();
});

/** Deferred so the test controls exactly when the action settles. */
function deferred<T = void>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

/**
 * The action deliberately writes **no state** — the only thing a component
 * could react to is the lifecycle flags themselves.
 */
const silentStore = (gate: Promise<void>) =>
    defineStore(name('silent'), {
        state: () => ({ untouched: 0 }),
        actions: {
            async save() {
                await gate;
            },
        },
    });

describe('async action lifecycle in React', () => {
    it('re-renders on pending via a useQuanta-resolved store', async () => {
        const gate = deferred();
        const definition = silentStore(gate.promise);

        const Component = () => {
            const store = useQuanta(definition);
            return (
                <button
                    onClick={() => store.save()}
                    disabled={store.save.pending}
                >
                    {store.save.pending ? 'Saving…' : 'Save'}
                </button>
            );
        };

        render(<Component />);
        const button = screen.getByRole('button');
        expect(button.textContent).toBe('Save');

        await act(async () => {
            button.click();
        });
        expect(button.textContent).toBe('Saving…');
        expect((button as HTMLButtonElement).disabled).toBe(true);

        await act(async () => {
            gate.resolve();
        });
        expect(button.textContent).toBe('Save');
        expect((button as HTMLButtonElement).disabled).toBe(false);
    });

    it('re-renders on error via a useQuanta-resolved store', async () => {
        const gate = deferred();
        const definition = silentStore(gate.promise);

        const Component = () => {
            const store = useQuanta(definition);
            return (
                <div>
                    <button onClick={() => store.save().catch(() => {})}>
                        Save
                    </button>
                    <span data-testid="err">
                        {store.save.error?.message ?? 'none'}
                    </span>
                </div>
            );
        };

        render(<Component />);
        expect(screen.getByTestId('err').textContent).toBe('none');

        await act(async () => {
            screen.getByRole('button').click();
        });
        await act(async () => {
            gate.reject(new Error('network down'));
        });

        expect(screen.getByTestId('err').textContent).toBe('network down');
    });

    it('re-renders on pending via a useQuantaValue selector', async () => {
        // The narrower path — should work for the same reason, and did even
        // before the notifier was wired up, since a selector tracks its own
        // reads rather than relying on the store-wide channel.
        const gate = deferred();
        const definition = silentStore(gate.promise);

        const Component = () => {
            const pending = useQuantaValue(definition, (s) => s.save.pending);
            const store = useQuanta(definition);
            return (
                <button onClick={() => store.save()}>
                    {pending ? 'Saving…' : 'Save'}
                </button>
            );
        };

        render(<Component />);
        const button = screen.getByRole('button');

        await act(async () => {
            button.click();
        });
        expect(button.textContent).toBe('Saving…');

        await act(async () => {
            gate.resolve();
        });
        expect(button.textContent).toBe('Save');
    });

    it('does not re-render a component for an unrelated action', async () => {
        // The notifier now depends on every action's lifecycle entry, so this
        // guards against that turning into a store-wide wake-up for any call.
        const gate = deferred();
        const definition = defineStore(name('two'), {
            state: () => ({ n: 0 }),
            actions: {
                async watched() {
                    await gate.promise;
                },
                async other() {
                    await Promise.resolve();
                },
            },
        });

        let renders = 0;
        const Component = () => {
            const pending = useQuantaValue(
                definition,
                (s) => s.watched.pending,
            );
            renders++;
            return <span>{String(pending)}</span>;
        };

        render(<Component />);
        const baseline = renders;

        await act(async () => {
            await definition().other();
        });
        expect(renders).toBe(baseline);

        gate.resolve();
    });
});
