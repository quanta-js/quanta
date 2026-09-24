/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountDevTools } from '../mount';

function mockBridge() {
    (window as any).__QUANTA_DEVTOOLS__ = {
        subscribe: vi.fn(() => vi.fn()),
    };
}

describe('mountDevTools', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mockBridge();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('returns no-op cleanup when visible is false', () => {
        const cleanup = mountDevTools({ visible: false });
        expect(typeof cleanup).toBe('function');
        expect(
            document.querySelector('#quanta-devtools-shadow-host'),
        ).toBeNull();
        cleanup();
    });

    it('mounts by default in a development build', () => {
        vi.stubEnv('NODE_ENV', 'development');
        const cleanup = mountDevTools();
        expect(
            document.querySelector('#quanta-devtools-shadow-host'),
        ).not.toBeNull();
        cleanup();
    });

    it('stays hidden by default outside a development build', () => {
        vi.stubEnv('NODE_ENV', 'production');
        const cleanup = mountDevTools();
        expect(
            document.querySelector('#quanta-devtools-shadow-host'),
        ).toBeNull();
        cleanup();
    });

    it('reports missing target through onError callback', () => {
        const onError = vi.fn();
        const cleanup = mountDevTools({
            visible: true,
            target: '#missing-target',
            onError,
        });

        expect(typeof cleanup).toBe('function');
        expect(onError).toHaveBeenCalledOnce();
        expect(
            document.querySelector('#quanta-devtools-shadow-host'),
        ).toBeNull();
        cleanup();
    });

    it('mounts and unmounts cleanly across repeated cycles', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);

        const cleanupA = mountDevTools({ visible: true, target: host });
        expect(
            host.querySelector('#quanta-devtools-shadow-host'),
        ).not.toBeNull();
        cleanupA();
        expect(host.querySelector('#quanta-devtools-shadow-host')).toBeNull();

        const cleanupB = mountDevTools({ visible: true, target: host });
        expect(
            host.querySelector('#quanta-devtools-shadow-host'),
        ).not.toBeNull();
        cleanupB();
        expect(host.querySelector('#quanta-devtools-shadow-host')).toBeNull();
    });

    it('supports CSS selector targets', () => {
        const host = document.createElement('div');
        host.id = 'devtools-host';
        document.body.appendChild(host);

        const cleanup = mountDevTools({
            visible: true,
            target: '#devtools-host',
        });
        expect(
            host.querySelector('#quanta-devtools-shadow-host'),
        ).not.toBeNull();
        cleanup();
    });
});
