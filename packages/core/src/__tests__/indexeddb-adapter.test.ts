import { describe, it, expect, vi, afterEach } from 'vitest';
import { IndexedDBAdapter } from '../persistence/adapters/indexedDB';
import { logger } from '../services/logger-service';

interface FakeIDBOptions {
    storeExists?: boolean;
    failOpen?: Error | string;
    failGet?: Error | string;
    failPut?: Error | string;
    failDelete?: Error | string;
}

/** Just enough of IndexedDB for the adapter: one store, async requests, and configurable failure hooks. */
function fakeIndexedDB(options: FakeIDBOptions = {}) {
    const records = new Map<string, unknown>();
    let failOpenNow = options.failOpen;
    let failGetNow = options.failGet;
    let failPutNow = options.failPut;
    let failDeleteNow = options.failDelete;
    let storeExists = options.storeExists ?? true;

    const request = (compute: () => unknown, getError?: () => Error | string | undefined) => {
        const req: Record<string, unknown> = {};
        queueMicrotask(() => {
            const err = getError?.();
            if (err !== undefined) {
                req.error = err;
                (req.onerror as (() => void) | undefined)?.();
                return;
            }
            req.result = compute();
            (req.onsuccess as (() => void) | undefined)?.();
        });
        return req;
    };

    const createObjectStore = vi.fn(() => {
        storeExists = true;
    });

    const db = {
        objectStoreNames: { contains: vi.fn(() => storeExists) },
        createObjectStore,
        onversionchange: null as null | (() => void),
        onclose: null as null | (() => void),
        close: vi.fn(),
        transaction: () => ({
            objectStore: () => ({
                get: (key: string) =>
                    request(
                        () => records.get(key),
                        () => failGetNow,
                    ),
                put: (record: { key: string }) =>
                    request(
                        () => void records.set(record.key, record),
                        () => failPutNow,
                    ),
                delete: (key: string) =>
                    request(
                        () => void records.delete(key),
                        () => failDeleteNow,
                    ),
            }),
        }),
    };

    const open = vi.fn(() => {
        const req: Record<string, unknown> = {};
        queueMicrotask(() => {
            if (failOpenNow !== undefined) {
                req.error = failOpenNow;
                (req.onerror as (() => void) | undefined)?.();
                return;
            }
            req.result = db;
            (req.onupgradeneeded as (() => void) | undefined)?.();
            (req.onsuccess as (() => void) | undefined)?.();
        });
        return req;
    });

    return {
        api: { open },
        db,
        open,
        records,
        createObjectStore,
        setFailOpen: (err?: Error | string) => {
            failOpenNow = err;
        },
        setFailGet: (err?: Error | string) => {
            failGetNow = err;
        },
        setFailPut: (err?: Error | string) => {
            failPutNow = err;
        },
        setFailDelete: (err?: Error | string) => {
            failDeleteNow = err;
        },
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

    it('reads a record that is not a string as empty', async () => {
        const fake = fakeIndexedDB();
        vi.stubGlobal('indexedDB', fake.api);
        fake.records.set('k', { key: 'k', data: { count: 1 } });

        expect(await new IndexedDBAdapter('k').read()).toBeNull();
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

    it('creates the object store on upgrade when missing and skips creation when it already exists', async () => {
        const fakeMissing = fakeIndexedDB({ storeExists: false });
        vi.stubGlobal('indexedDB', fakeMissing.api);
        const adapter1 = new IndexedDBAdapter('k', 'quantajs', 'stores', 1);
        await adapter1.write('{"v":1}');
        expect(fakeMissing.createObjectStore).toHaveBeenCalledTimes(1);
        expect(fakeMissing.createObjectStore).toHaveBeenCalledWith('stores', { keyPath: 'key' });

        const fakeExisting = fakeIndexedDB({ storeExists: true });
        vi.stubGlobal('indexedDB', fakeExisting.api);
        const adapter2 = new IndexedDBAdapter('k', 'quantajs', 'stores', 1);
        await adapter2.write('{"v":2}');
        expect(fakeExisting.createObjectStore).not.toHaveBeenCalled();
    });

    it('resolves to null and logs a warning in development when a read request errors', async () => {
        const fake = fakeIndexedDB({ failGet: new Error('QuotaExceededError') });
        vi.stubGlobal('indexedDB', fake.api);
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const adapter = new IndexedDBAdapter('k');

        expect(await adapter.read()).toBeNull();
        expect(warn).toHaveBeenCalledWith('IndexedDB read failed: QuotaExceededError');

        // Also cover non-Error rejection payload formatting
        fake.setFailGet('raw-string-failure');
        expect(await adapter.read()).toBeNull();
        expect(warn).toHaveBeenCalledWith('IndexedDB read failed: raw-string-failure');
    });

    it('rejects when write or remove requests fail', async () => {
        const writeErr = new Error('WriteTransactionFailed');
        const deleteErr = new Error('DeleteTransactionFailed');
        const fake = fakeIndexedDB({ failPut: writeErr, failDelete: deleteErr });
        vi.stubGlobal('indexedDB', fake.api);
        const adapter = new IndexedDBAdapter('k');

        await expect(adapter.write('{"a":1}')).rejects.toThrow('WriteTransactionFailed');
        await expect(adapter.remove()).rejects.toThrow('DeleteTransactionFailed');
    });

    it('reopens a fresh connection on the next operation after the connection closes', async () => {
        const fake = fakeIndexedDB();
        vi.stubGlobal('indexedDB', fake.api);
        const adapter = new IndexedDBAdapter('k');

        await adapter.write('{"step":1}');
        expect(fake.open).toHaveBeenCalledTimes(1);

        fake.db.onclose?.();
        await adapter.write('{"step":2}');
        expect(fake.open).toHaveBeenCalledTimes(2);
        expect(await adapter.read()).toBe('{"step":2}');
    });

    it('surfaces database open errors and retries opening on a subsequent call', async () => {
        const openErr = new Error('OpenBlockedInPrivateWindow');
        const fake = fakeIndexedDB({ failOpen: openErr });
        vi.stubGlobal('indexedDB', fake.api);
        const adapter = new IndexedDBAdapter('k');

        await expect(adapter.write('{"retry":true}')).rejects.toThrow('OpenBlockedInPrivateWindow');
        expect(fake.open).toHaveBeenCalledTimes(1);

        // Clear the open failure and confirm the next call retries indexedDB.open
        fake.setFailOpen(undefined);
        await expect(adapter.write('{"retry":true}')).resolves.toBeUndefined();
        expect(fake.open).toHaveBeenCalledTimes(2);
        expect(await adapter.read()).toBe('{"retry":true}');
    });
});
