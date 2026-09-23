import { describe, it, expect, vi, afterEach } from 'vitest';
import { IndexedDBAdapter } from '../persistence/adapters/indexedDB';
import { logger } from '../services/logger-service';

/** Just enough of IndexedDB for the adapter: one store, async requests. */
function fakeIndexedDB() {
    const records = new Map<string, unknown>();
    const request = (compute: () => unknown) => {
        const req: Record<string, unknown> = {};
        queueMicrotask(() => {
            req.result = compute();
            (req.onsuccess as (() => void) | undefined)?.();
        });
        return req;
    };
    const db = {
        objectStoreNames: { contains: () => true },
        onversionchange: null as null | (() => void),
        onclose: null as null | (() => void),
        close: vi.fn(),
        transaction: () => ({
            objectStore: () => ({
                get: (key: string) => request(() => records.get(key)),
                put: (record: { key: string }) =>
                    request(() => void records.set(record.key, record)),
                delete: (key: string) =>
                    request(() => void records.delete(key)),
            }),
        }),
    };
    const open = vi.fn(() => request(() => db));
    return { api: { open }, db, open, records };
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('IndexedDBAdapter', () => {
    it('round-trips data over one reused connection', async () => {
        const fake = fakeIndexedDB();
        vi.stubGlobal('indexedDB', fake.api);
        const adapter = new IndexedDBAdapter('k');

        expect(await adapter.read()).toBeNull();
        await adapter.write('{"a":1}');
        await adapter.write('{"a":2}');
        expect(await adapter.read()).toBe('{"a":2}');
        await adapter.remove();
        expect(await adapter.read()).toBeNull();

        expect(fake.open).toHaveBeenCalledTimes(1);
    });

    it('reconnects after another tab upgrades the database', async () => {
        const fake = fakeIndexedDB();
        vi.stubGlobal('indexedDB', fake.api);
        const adapter = new IndexedDBAdapter('k');

        await adapter.write('1');
        fake.db.onversionchange?.();
        expect(fake.db.close).toHaveBeenCalled();
        await adapter.write('2');

        expect(fake.open).toHaveBeenCalledTimes(2);
    });

    it('does nothing where indexedDB does not exist', async () => {
        vi.stubGlobal('indexedDB', undefined);
        const warn = vi.spyOn(logger, 'warn');
        const adapter = new IndexedDBAdapter('k');

        expect(await adapter.read()).toBeNull();
        await expect(adapter.write('x')).resolves.toBeUndefined();
        await expect(adapter.remove()).resolves.toBeUndefined();
        expect(warn).not.toHaveBeenCalled();
    });
});
