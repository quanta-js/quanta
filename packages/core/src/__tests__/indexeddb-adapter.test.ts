import { describe, it, expect, vi, afterEach } from 'vitest';
import { IndexedDBAdapter } from '../persistence/adapters/indexedDB';
import { logger } from '../services/logger-service';

type FakeIndexedDBOptions = {
    readError?: Error;
    writeError?: Error;
    removeError?: Error;
    openErrorOnce?: Error;
    triggerUpgrade?: boolean;
    storeExists?: boolean;
};

/** Just enough of IndexedDB for the adapter: one store, async requests. */
function fakeIndexedDB(options: FakeIndexedDBOptions = {}) {
    const records = new Map<string, unknown>();
    const request = (compute: () => unknown, error?: Error) => {
        const req: Record<string, unknown> = {};
        queueMicrotask(() => {
            if (error) {
                req.error = error;
                (req.onerror as (() => void) | undefined)?.();
                return;
            }

            req.result = compute();
            (req.onsuccess as (() => void) | undefined)?.();
        });
        return req;
    };
    const contains = vi.fn(() => options.storeExists ?? true);
    const createObjectStore = vi.fn();
    const db = {
        objectStoreNames: { contains },
        createObjectStore,
        onversionchange: null as null | (() => void),
        onclose: null as null | (() => void),
        close: vi.fn(),
        transaction: () => ({
            objectStore: () => ({
                get: (key: string) =>
                    request(() => records.get(key), options.readError),
                put: (record: { key: string }) =>
                    request(
                        () => void records.set(record.key, record),
                        options.writeError,
                    ),
                delete: (key: string) =>
                    request(
                        () => void records.delete(key),
                        options.removeError,
                    ),
            }),
        }),
    };

    let openError = options.openErrorOnce;
    const open = vi.fn(() => {
        const error = openError;
        openError = undefined;
        const req: Record<string, unknown> = {};

        queueMicrotask(() => {
            if (error) {
                req.error = error;
                (req.onerror as (() => void) | undefined)?.();
                return;
            }

            req.result = db;
            if (options.triggerUpgrade) {
                (req.onupgradeneeded as (() => void) | undefined)?.();
            }
            (req.onsuccess as (() => void) | undefined)?.();
        });

        return req;
    });

    return {
        api: { open },
        db,
        open,
        records,
        contains,
        createObjectStore,
    };
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

    it('reconnects after the database connection closes', async () => {
        const fake = fakeIndexedDB();
        vi.stubGlobal('indexedDB', fake.api);
        const adapter = new IndexedDBAdapter('k');

        await adapter.write('1');
        fake.db.onclose?.();
        await adapter.write('2');

        expect(fake.open).toHaveBeenCalledTimes(2);
    });

    it('does not recreate an existing object store during an upgrade', async () => {
        const fake = fakeIndexedDB({
            triggerUpgrade: true,
            storeExists: true,
        });
        vi.stubGlobal('indexedDB', fake.api);

        await new IndexedDBAdapter('k').write('1');

        expect(fake.contains).toHaveBeenCalledWith('stores');
        expect(fake.createObjectStore).not.toHaveBeenCalled();
    });

    it('creates the object store during an upgrade when it is missing', async () => {
        const fake = fakeIndexedDB({
            triggerUpgrade: true,
            storeExists: false,
        });
        vi.stubGlobal('indexedDB', fake.api);

        await new IndexedDBAdapter('k').write('1');

        expect(fake.createObjectStore).toHaveBeenCalledWith('stores', {
            keyPath: 'key',
        });
    });

    it('reads a record that is not a string as empty', async () => {
        const fake = fakeIndexedDB();
        vi.stubGlobal('indexedDB', fake.api);
        fake.records.set('k', { key: 'k', data: { count: 1 } });

        expect(await new IndexedDBAdapter('k').read()).toBeNull();
    });

    it('returns null and warns when a read request fails', async () => {
        const fake = fakeIndexedDB({
            readError: new Error('read failed'),
        });
        vi.stubGlobal('indexedDB', fake.api);
        const warn = vi.spyOn(logger, 'warn');

        expect(await new IndexedDBAdapter('k').read()).toBeNull();
        expect(warn).toHaveBeenCalledWith(
            'IndexedDB read failed: read failed',
        );
    });

    it('rejects when write and remove requests fail', async () => {
        const fake = fakeIndexedDB({
            writeError: new Error('write failed'),
            removeError: new Error('remove failed'),
        });
        vi.stubGlobal('indexedDB', fake.api);
        const adapter = new IndexedDBAdapter('k');

        await expect(adapter.write('x')).rejects.toThrow('write failed');
        await expect(adapter.remove()).rejects.toThrow('remove failed');
    });

    it('retries opening the database after an open failure', async () => {
        const fake = fakeIndexedDB({
            openErrorOnce: new Error('open failed'),
        });
        vi.stubGlobal('indexedDB', fake.api);
        const adapter = new IndexedDBAdapter('k');

        await expect(adapter.write('1')).rejects.toThrow('open failed');
        await expect(adapter.write('2')).resolves.toBeUndefined();

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
