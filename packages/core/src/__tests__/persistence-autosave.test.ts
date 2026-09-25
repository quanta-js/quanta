/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createContainer } from '../core/container';
import { defineStore } from '../core/define-store';
import type { PersistenceAdapter } from '../type/persistence-types';
import { logger } from '../services/logger-service';

let uid = 0;

function setup(persist: Record<string, unknown> = {}) {
    const write = vi.fn();
    const adapter: PersistenceAdapter = {
        key: 'k',
        read: () => null,
        write,
        remove: vi.fn(),
    };
    const store = defineStore(`autosave_${++uid}`, {
        state: () => ({
            count: 0,
            draft: '',
            user: { profile: { name: 'ada' } },
            tags: [] as string[],
        }),
        persist: { adapter, debounceMs: 100, ...persist },
    })(createContainer());
    return { store, write };
}

const written = (write: ReturnType<typeof vi.fn>) =>
    JSON.parse(write.mock.lastCall![0]).data;

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('persistence auto-save', () => {
    it('saves a nested change after the debounce', async () => {
        const { store, write } = setup();
        await vi.runAllTimersAsync();

        store.user.profile.name = 'grace';
        expect(write).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(100);

        expect(write).toHaveBeenCalledTimes(1);
        expect(written(write).user.profile.name).toBe('grace');
    });

    it('saves array mutations', async () => {
        const { store, write } = setup();
        await vi.runAllTimersAsync();

        store.tags.push('a');
        await vi.advanceTimersByTimeAsync(100);

        expect(written(write).tags).toEqual(['a']);
    });

    it('tracks an object that replaced the previous value', async () => {
        const { store, write } = setup();
        await vi.runAllTimersAsync();

        store.user = { profile: { name: 'grace' } };
        await vi.advanceTimersByTimeAsync(100);
        store.user.profile.name = 'hopper';
        await vi.advanceTimersByTimeAsync(100);

        expect(written(write).user.profile.name).toBe('hopper');
    });

    it('ignores keys outside include', async () => {
        const { store, write } = setup({ include: ['count'] });
        await vi.runAllTimersAsync();

        store.draft = 'typing';
        store.user.profile.name = 'grace';
        await vi.advanceTimersByTimeAsync(100);

        expect(write).not.toHaveBeenCalled();
    });

    it('writes a pending change when the page is hidden', async () => {
        const { store, write } = setup();
        await vi.runAllTimersAsync();

        store.count = 5;
        window.dispatchEvent(new Event('pagehide'));

        expect(write).toHaveBeenCalledTimes(1);
        expect(written(write).count).toBe(5);
    });

    it('writes a pending change on $destroy()', async () => {
        const { store, write } = setup();
        await vi.runAllTimersAsync();

        store.count = 7;
        store.$destroy();

        expect(write).toHaveBeenCalledTimes(1);
        expect(written(write).count).toBe(7);
    });

    it('stops listening after $destroy()', async () => {
        const { store, write } = setup();
        await vi.runAllTimersAsync();
        store.$destroy();

        window.dispatchEvent(new Event('pagehide'));
        await vi.advanceTimersByTimeAsync(100);

        expect(write).not.toHaveBeenCalled();
    });
});
