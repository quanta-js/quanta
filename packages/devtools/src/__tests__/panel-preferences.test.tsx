/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { DevTools } from '../DevTools';

const key = 'quanta-devtools:ui';
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal('localStorage', new Storage());
    container = document.createElement('div');
    document.body.appendChild(container);
});

afterEach(() => {
    act(() => render(null, container));
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

async function mount() {
    await act(async () => render(h(DevTools, {}), container));
}

async function click(selector: string) {
    const button = container.querySelector<HTMLButtonElement>(selector);
    expect(button).not.toBeNull();
    await act(async () => button!.click());
}

describe('panel preferences', () => {
    it('persists open state and selected tab across a remount, including closing', async () => {
        localStorage.setItem('store-data', '{"count":7}');
        await mount();
        expect(container.querySelector('.qdt-panel')).toBeNull();
        await click('.qdt-fab');
        await click('.qdt-tab:nth-child(2)');
        expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
            isOpen: true,
            activeTab: 'actions',
        });
        await act(async () => render(null, container));
        await mount();
        expect(
            container.querySelector('.qdt-tab[data-active="true"]')
                ?.textContent,
        ).toBe('Actions');
        await click('.qdt-close');
        expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
            isOpen: false,
            activeTab: 'actions',
        });
        expect(localStorage.getItem('store-data')).toBe('{"count":7}');
    });

    it.each([
        'broken',
        'null',
        '[]',
        '42',
        '{"isOpen":"yes","activeTab":"unknown"}',
    ])('uses defaults for invalid saved data: %s', async (value) => {
        localStorage.setItem(key, value);
        await mount();
        expect(container.querySelector('.qdt-fab')).not.toBeNull();
        await click('.qdt-fab');
        expect(
            container.querySelector('.qdt-tab[data-active="true"]')
                ?.textContent,
        ).toBe('Inspector');
    });

    it('retains a valid open flag while ignoring an unknown tab', async () => {
        localStorage.setItem(
            key,
            JSON.stringify({ isOpen: true, activeTab: 'unknown' }),
        );
        await mount();
        expect(
            container.querySelector('.qdt-tab[data-active="true"]')
                ?.textContent,
        ).toBe('Inspector');
    });

    it('continues to work when reads and writes throw', async () => {
        vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        await mount();
        await click('.qdt-fab');
        await click('.qdt-tab:nth-child(2)');
        expect(
            container.querySelector('.qdt-tab[data-active="true"]')
                ?.textContent,
        ).toBe('Actions');
        await click('.qdt-close');
        expect(container.querySelector('.qdt-fab')).not.toBeNull();
    });

    it('continues to work when storage is missing', async () => {
        vi.stubGlobal('localStorage', undefined);
        await mount();
        await click('.qdt-fab');
        expect(container.querySelector('.qdt-panel')).not.toBeNull();
    });
});
