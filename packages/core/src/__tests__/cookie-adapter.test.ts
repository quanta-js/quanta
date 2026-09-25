import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { CookieAdapter } from '../index';
import type { CookieAdapterOptions } from '../index';
import { logger } from '../services/logger-service';
import { createPersistenceManager } from '../persistence/core';

describe('CookieAdapter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal(
            'document',
            new Window({ url: 'https://example.com/app/' }).document,
        );
        vi.spyOn(logger, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('round-trips serialized state and reserved/unicode characters', () => {
        const adapter = new CookieAdapter('theme =;ü');
        const value = JSON.stringify({ text: '日本語;%=+', theme: 'dark' });
        adapter.write(value);
        expect(adapter.read()).toBe(value);
        adapter.remove();
        // happy-dom expires cookies only after their expiry timestamp.
        vi.advanceTimersByTime(1);
        expect(adapter.read()).toBeNull();
    });

    it('matches the whole cookie name and preserves empty values', () => {
        document.cookie = 'theme-other=wrong; Path=/';
        document.cookie = 'unrelated=%ZZ; Path=/';
        const adapter = new CookieAdapter('theme');
        expect(adapter.read()).toBeNull();
        adapter.write('');
        expect(adapter.read()).toBe('');
    });

    it('uses the same scope when removing a cookie', () => {
        const options: CookieAdapterOptions = {
            path: '/app',
            domain: 'example.com',
            sameSite: 'Strict',
            secure: true,
            maxAge: 600,
        };
        const adapter = new CookieAdapter('scoped', options);
        adapter.write('saved');
        expect(adapter.read()).toBe('saved');
        options.path = '/changed';
        adapter.remove();
        // happy-dom expires cookies only after their expiry timestamp.
        vi.advanceTimersByTime(1);
        expect(adapter.read()).toBeNull();
    });

    it('writes default and custom attributes, including deletion expiry', () => {
        const setter = vi.fn();
        vi.stubGlobal('document', {
            set cookie(value: string) {
                setter(value);
            },
        });
        new CookieAdapter('default').write('x');
        expect(setter).toHaveBeenLastCalledWith(
            'default=x; Path=/; Max-Age=2592000; SameSite=Lax',
        );
        const adapter = new CookieAdapter('custom', {
            path: '/app',
            maxAge: 90,
            sameSite: 'None',
            secure: true,
            domain: 'example.com',
        });
        adapter.write('x');
        expect(setter).toHaveBeenLastCalledWith(
            'custom=x; Path=/app; Max-Age=90; SameSite=None; Domain=example.com; Secure',
        );
        adapter.remove();
        expect(setter).toHaveBeenLastCalledWith(
            'custom=; Path=/app; Max-Age=0; SameSite=None; Domain=example.com; Secure',
        );
    });

    it('does nothing without a document', () => {
        vi.stubGlobal('document', undefined);
        const adapter = new CookieAdapter('ssr');
        expect(adapter.read()).toBeNull();
        expect(() => adapter.write('value')).not.toThrow();
        expect(() => adapter.remove()).not.toThrow();
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('returns null for bad reads and throws for blocked writes', () => {
        document.cookie = 'bad=%ZZ; Path=/';
        expect(new CookieAdapter('bad').read()).toBeNull();
        vi.stubGlobal('document', {
            get cookie(): string {
                throw new Error('blocked');
            },
            set cookie(_value: string) {
                throw new Error('blocked');
            },
        });
        const adapter = new CookieAdapter('blocked');
        expect(adapter.read()).toBeNull();
        expect(() => adapter.write('x')).toThrow('CookieAdapter: write failed');
        expect(() => adapter.remove()).not.toThrow();
        expect(logger.warn).toHaveBeenCalledTimes(3);
    });

    it('refuses oversized encoded values without overwriting prior state', () => {
        const adapter = new CookieAdapter('limit');
        adapter.write('original');
        expect(() => adapter.write('ü'.repeat(1000))).toThrow('4096 bytes');
        expect(adapter.read()).toBe('original');
    });

    it('counts the whole cookie at the 4096 byte boundary', () => {
        const setter = vi.fn();
        vi.stubGlobal('document', {
            set cookie(value: string) {
                setter(value);
            },
        });
        const overhead = 'key=; Path=/; Max-Age=2592000; SameSite=Lax'.length;
        const adapter = new CookieAdapter('key');
        adapter.write('x'.repeat(4096 - overhead));
        expect(setter.mock.calls[0][0]).toHaveLength(4096);
        expect(() => adapter.write('x'.repeat(4097 - overhead))).toThrow(
            '4096 bytes',
        );
        expect(setter).toHaveBeenCalledTimes(1);
    });

    it.each<CookieAdapterOptions>([
        { path: '/; Secure' },
        { domain: 'example.com; Path=/' },
        { path: '/\n' },
        { maxAge: NaN },
        { maxAge: 1.5 },
        { sameSite: 'None' },
    ])('refuses invalid attributes: %j', (options) => {
        expect(() => new CookieAdapter('invalid', options).write('x')).toThrow(
            'invalid cookie options',
        );
        expect(document.cookie).toBe('');
    });

    it.each(['oversized', 'blocked'])(
        'reports %s writes through persistence onError',
        async (failure) => {
            const adapter = new CookieAdapter('state');
            if (failure === 'blocked') {
                vi.stubGlobal('document', {
                    get cookie() {
                        return '';
                    },
                    set cookie(_value: string) {
                        throw new Error('blocked');
                    },
                });
            }
            const onError = vi.fn();
            const manager = createPersistenceManager(
                () => ({
                    value: failure === 'oversized' ? 'x'.repeat(5000) : 'small',
                }),
                vi.fn(),
                vi.fn(),
                { adapter, onError },
            );
            await vi.runAllTimersAsync();
            await manager.save();
            expect(onError).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining(
                        failure === 'oversized' ? '4096 bytes' : 'write failed',
                    ),
                }),
                'write',
            );
            manager.destroy();
        },
    );
});
