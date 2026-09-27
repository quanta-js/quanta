/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { ActionLog } from '../components/ActionLog';
import { DevTools } from '../DevTools';

const actions = [
    {
        id: '1',
        storeName: 'Cart',
        actionName: 'addItem',
        args: [],
        timestamp: 0,
    },
    {
        id: '2',
        storeName: 'User',
        actionName: 'signIn',
        args: [],
        timestamp: 1,
    },
];
let container: HTMLDivElement;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});
afterEach(() => {
    act(() => render(null, container));
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

async function filter(value: string) {
    const input = container.querySelector<HTMLInputElement>(
        'input[type="search"]',
    )!;
    await act(async () => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

describe('ActionLog', () => {
    it('filters by store or action name regardless of case and shows no matches', async () => {
        await act(async () =>
            render(h(ActionLog, { actions, onClear: vi.fn() }), container),
        );
        expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
        await filter('cArT');
        expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
        expect(container.querySelector('tbody')?.textContent).toContain(
            'addItem',
        );
        await filter('SIGNIN');
        expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
        expect(container.querySelector('tbody')?.textContent).toContain('User');
        await filter('missing');
        expect(container.querySelector('tbody')).toBeNull();
        expect(container.textContent).toContain('No actions match "missing"');
        await filter('');
        expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    });

    it('keeps clear available with no filter matches, but disables it for an empty log', async () => {
        const onClear = vi.fn();
        await act(async () =>
            render(h(ActionLog, { actions, onClear }), container),
        );
        await filter('missing');
        const clear = container.querySelector<HTMLButtonElement>(
            '.qdt-actions-toolbar button',
        )!;
        expect(clear.disabled).toBe(false);
        await act(async () => clear.click());
        expect(onClear).toHaveBeenCalledOnce();
        await act(async () =>
            render(h(ActionLog, { actions: [], onClear }), container),
        );
        expect(clear.disabled).toBe(true);
        expect(container.textContent).toContain('No actions recorded yet');
    });

    it('wires Clear to the bridge and displays actions arriving afterwards', async () => {
        let emit: ((event: unknown) => void) | undefined;
        vi.stubGlobal('__QUANTA_DEVTOOLS__', {
            subscribe: (handler: (event: unknown) => void) => {
                emit = handler;
                return () => {};
            },
        });
        await act(async () => render(h(DevTools, {}), container));
        await act(async () =>
            container.querySelector<HTMLButtonElement>('.qdt-fab')!.click(),
        );
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>('.qdt-tab:nth-child(2)')!
                .click(),
        );
        const event = (actionName: string) => ({
            type: 'ACTION_CALL',
            payload: { storeName: 'Cart', actionName, args: [] },
        });
        await act(async () => emit!(event('before')));
        expect(container.querySelector('tbody')?.textContent).toContain(
            'before',
        );
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>(
                    '.qdt-actions-toolbar button',
                )!
                .click(),
        );
        expect(container.textContent).toContain('No actions recorded yet');
        await act(async () => emit!(event('after')));
        expect(container.querySelector('tbody')?.textContent).toContain(
            'after',
        );
        expect(container.querySelector('tbody')?.textContent).not.toContain(
            'before',
        );
    });
});
