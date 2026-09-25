/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageAdapter } from '../persistence/adapters/localStorage';
import { SessionStorageAdapter } from '../persistence/adapters/sessionStorage';
import { logger } from '../services/logger-service';

beforeEach(() => {
    // Fresh instances isolate happy-dom's lazily bound storage methods and spies.
    vi.stubGlobal('localStorage', new Storage());
    vi.stubGlobal('sessionStorage', new Storage());
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe.each([
    ['localStorage', LocalStorageAdapter],
    ['sessionStorage', SessionStorageAdapter],
] as const)('%s adapter', (kind, Adapter) => {
    it('round-trips strings and removes only its own key', () => {
        const adapter = new Adapter('state');
        window[kind].setItem('other', 'keep');
        expect(adapter.read()).toBeNull();
        adapter.write('{"count":1}');
        expect(adapter.read()).toBe('{"count":1}');
        adapter.write('');
        expect(adapter.read()).toBe('');
        adapter.remove();
        expect(adapter.read()).toBeNull();
        expect(window[kind].getItem('other')).toBe('keep');
    });

    it('disables persistence when the constructor probe throws', () => {
        const write = vi
            .spyOn(window[kind], 'setItem')
            .mockImplementation(() => {
                throw new Error('blocked');
            });
        const adapter = new Adapter('state');
        expect(write).toHaveBeenCalledTimes(1);
        write.mockClear();
        const read = vi.spyOn(window[kind], 'getItem');
        const remove = vi.spyOn(window[kind], 'removeItem');
        expect(adapter.read()).toBeNull();
        expect(() => adapter.write('value')).not.toThrow();
        expect(() => adapter.remove()).not.toThrow();
        expect(write).not.toHaveBeenCalled();
        expect(read).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('unavailable'),
        );
    });

    it('warns and rethrows quota errors after a successful probe', () => {
        const adapter = new Adapter('state');
        const error = new Error('full');
        error.name = 'QuotaExceededError';
        vi.spyOn(window[kind], 'setItem').mockImplementation(() => {
            throw error;
        });
        expect(() => adapter.write('value')).toThrow(error);
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('quota exceeded'),
        );
    });

    it('returns null when reading fails after construction', () => {
        const adapter = new Adapter('state');
        vi.spyOn(window[kind], 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(adapter.read()).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('read failed'),
        );
    });

    it('tolerates failed removal after construction', () => {
        const adapter = new Adapter('state');
        vi.spyOn(window[kind], 'removeItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(() => adapter.remove()).not.toThrow();
    });

    it('is a no-op without window during SSR', () => {
        vi.stubGlobal('window', undefined);
        const adapter = new Adapter('state');
        expect(adapter.read()).toBeNull();
        expect(() => adapter.write('value')).not.toThrow();
        expect(() => adapter.remove()).not.toThrow();
        expect(logger.warn).not.toHaveBeenCalled();
    });
});

describe('LocalStorageAdapter subscriptions', () => {
    it('filters storage events, forwards removals and stops after unsubscribe', () => {
        const adapter = new LocalStorageAdapter('state');
        const callback = vi.fn();
        const unsubscribe = adapter.subscribe(callback);
        const dispatch = (
            key: string,
            newValue: string | null,
            storageArea: Storage,
        ) => {
            window.dispatchEvent(
                new StorageEvent('storage', { key, newValue, storageArea }),
            );
        };

        dispatch('other', 'ignore', localStorage);
        dispatch('state', 'ignore', sessionStorage);
        expect(callback).not.toHaveBeenCalled();
        dispatch('state', 'value', localStorage);
        dispatch('state', null, localStorage);
        expect(callback.mock.calls).toEqual([['value'], [null]]);
        unsubscribe();
        dispatch('state', 'later', localStorage);
        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('does not listen when storage is unavailable', () => {
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const adapter = new LocalStorageAdapter('state');
        const listen = vi.spyOn(window, 'addEventListener');
        const unsubscribe = adapter.subscribe(vi.fn());
        expect(listen).not.toHaveBeenCalled();
        expect(() => unsubscribe()).not.toThrow();
    });
});
