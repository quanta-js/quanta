/**
 * @vitest-environment happy-dom
 *
 * The barrel must not ship the DevTools panel.
 *
 * `QuantaDevTools` dynamically imports `@quantajs/devtools`, and bundlers
 * resolve that specifier at build time even though the package is an *optional*
 * peer. While the panel lived in the barrel, every application importing
 * anything at all from `@quantajs/react` failed to build with
 * `Module not found: Can't resolve '@quantajs/devtools'`.
 *
 * The real proof is `scripts/verify-packaging.mjs`, which builds a throwaway app
 * against the packed tarball with the peer absent. This is the fast unit-level
 * guard for the half that is observable in-process: that the barrel's export is
 * the inert stub and the subpath's is the real panel.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { QuantaDevTools as BarrelDevTools } from '../index';
import { QuantaDevTools as SubpathDevTools } from '../devtools';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('DevTools entry points', () => {
    it('the barrel export renders nothing and warns', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { container } = render(<BarrelDevTools />);

        expect(container.innerHTML).toBe('');
        expect(warn).toHaveBeenCalledTimes(1);

        const message = String(warn.mock.calls[0][0]);
        // The warning is the entire migration path for anyone whose panel just
        // stopped mounting, so it has to name the replacement import.
        expect(message).toContain('@quantajs/react/devtools');
        expect(message).toContain('@quantajs/devtools');
    });

    it('warns only once per process, however many mount', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        render(<BarrelDevTools />);
        render(<BarrelDevTools />);
        render(<BarrelDevTools />);

        // The first test already consumed the one warning for this process.
        expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('the barrel and the subpath are different components', () => {
        // If these ever converge, the barrel is shipping the panel again and
        // the packaging bug is back.
        expect(BarrelDevTools).not.toBe(SubpathDevTools);
    });

    it('the subpath export is a component', () => {
        expect(typeof SubpathDevTools).toBe('function');
    });
});
