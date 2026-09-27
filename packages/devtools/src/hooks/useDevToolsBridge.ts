import { useState, useEffect, useRef } from 'preact/hooks';

interface ActionInfo {
    id: string;
    storeName: string;
    actionName: string;
    args: any[];
    timestamp: number;
}

function createActionId(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

export interface StoreSnapshot {
    state: unknown;
    getters: Record<string, unknown>;
}

/** Run once per frame at most, so a burst of writes costs one render. */
const scheduleFrame = (fn: () => void): (() => void) => {
    if (typeof requestAnimationFrame === 'function') {
        const id = requestAnimationFrame(fn);
        return () => cancelAnimationFrame(id);
    }
    const id = setTimeout(fn, 16);
    return () => clearTimeout(id);
};

export function useDevToolsBridge() {
    const [stores, setStores] = useState<Record<string, any>>({});
    const [actions, setActions] = useState<ActionInfo[]>([]);
    const [selectedStore, setSelectedStore] = useState<string | null>(null);
    const [version, setVersion] = useState(0);
    const bridgeRef = useRef<any>(null);
    const selectedStoreRef = useRef(selectedStore);

    // Keep ref in sync so the effect closure has the latest value
    selectedStoreRef.current = selectedStore;

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        let retryCount = 0;
        const maxRetries = 10;
        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let cancelFrame: (() => void) | null = null;

        const handleEvent = (event: any) => {
            if (event.type === 'STORE_INIT') {
                setStores((prev) => {
                    const newStores = {
                        ...prev,
                        [event.payload.name]: event.payload.store,
                    };
                    // Auto-select first store
                    if (!selectedStoreRef.current) {
                        setSelectedStore(event.payload.name);
                    }
                    return newStores;
                });
            } else if (event.type === 'STATE_CHANGE') {
                if (cancelFrame === null) {
                    cancelFrame = scheduleFrame(() => {
                        cancelFrame = null;
                        setVersion((v) => v + 1);
                    });
                }
            } else if (event.type === 'STORE_DISPOSE') {
                const name = event.payload.name;
                setStores((prev) => {
                    if (!(name in prev)) return prev;
                    const next = { ...prev };
                    delete next[name];
                    return next;
                });
                if (selectedStoreRef.current === name) setSelectedStore(null);
            } else if (event.type === 'ACTION_CALL') {
                setActions((prev) => [
                    {
                        id: createActionId(),
                        storeName: event.payload.storeName,
                        actionName: event.payload.actionName,
                        args: event.payload.args,
                        timestamp: Date.now(),
                    },
                    ...prev.slice(0, 99), // Keep last 100 actions
                ]);
            }
        };

        const connect = () => {
            if (cancelled) return;
            const devtools = (window as any).__QUANTA_DEVTOOLS__;
            if (devtools) {
                bridgeRef.current = devtools;
                unsubscribe = devtools.subscribe(handleEvent);
            } else if (retryCount < maxRetries) {
                retryCount++;
                retryTimer = setTimeout(connect, 500);
            }
        };

        connect();

        return () => {
            cancelled = true;
            if (retryTimer) {
                clearTimeout(retryTimer);
                retryTimer = null;
            }
            cancelFrame?.();
            if (unsubscribe) unsubscribe();
        };
    }, []); // No dependency on selectedStore — uses ref instead

    /**
     * What to display for a store. The bridge's snapshot is plain data with
     * `redact` applied; the live store is only a fallback for an older core
     * that has no snapshot().
     */
    const snapshotOf = (name: string): StoreSnapshot | undefined => {
        const fromBridge = bridgeRef.current?.snapshot?.(name);
        if (fromBridge) return fromBridge;
        const store = stores[name];
        if (!store) return undefined;
        const getters: Record<string, unknown> = {};
        for (const [key, getter] of Object.entries<any>(store.getters ?? {})) {
            getters[key] = getter?.value;
        }
        return { state: store.state, getters };
    };

    return {
        stores,
        actions,
        clearActions: () => setActions([]),
        selectedStore,
        setSelectedStore,
        snapshotOf,
        version,
    };
}
