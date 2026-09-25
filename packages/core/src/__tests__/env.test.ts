import { afterEach, describe, expect, it, vi } from 'vitest';

/** `__DEV__` is read once, at module load, so each case loads a fresh copy. */
async function loadDev(nodeEnv: string): Promise<boolean> {
    vi.stubEnv('NODE_ENV', nodeEnv);
    vi.resetModules();
    return (await import('../utils/env')).__DEV__;
}

describe('__DEV__', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('is off in a production build', async () => {
        expect(await loadDev('production')).toBe(false);
    });

    it('is on in development and tests', async () => {
        expect(await loadDev('development')).toBe(true);
        expect(await loadDev('test')).toBe(true);
    });
});
