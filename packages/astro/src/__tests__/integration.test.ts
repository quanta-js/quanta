import { describe, it, expect, vi } from 'vitest';
import quanta from '../index';

describe('quanta()', () => {
    it('adds the middleware first and the client before hydration', () => {
        const addMiddleware = vi.fn();
        const injectScript = vi.fn();
        const integration = quanta();
        (integration.hooks['astro:config:setup'] as (o: unknown) => void)({
            addMiddleware,
            injectScript,
        });

        expect(integration.name).toBe('@quantajs/astro');
        expect(addMiddleware).toHaveBeenCalledWith({
            entrypoint: '@quantajs/astro/middleware',
            order: 'pre',
        });
        expect(injectScript).toHaveBeenCalledWith(
            'before-hydration',
            `import '@quantajs/astro/client';`,
        );
    });

    it('types Astro.locals.quanta', () => {
        const injectTypes = vi.fn();
        (quanta().hooks['astro:config:done'] as (o: unknown) => void)({
            injectTypes,
        });
        const [{ content }] = injectTypes.mock.calls[0];
        expect(content).toContain(
            "quanta: import('@quantajs/core').StoreContainer",
        );
    });
});
