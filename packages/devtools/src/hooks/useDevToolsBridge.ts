import { useState, useEffect } from 'preact/hooks';

interface ActionInfo {
    id: string;
    storeName: string;
    actionName: string;
    args: any[];
    timestamp: number;
}

export function useDevToolsBridge() {
    const [stores, setStores] = useState<Record<string, any>>({});
    const [actions, setActions] = useState<ActionInfo[]>([]);
    const [selectedStore, setSelectedStore] = useState<string | null>(null);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        let retryCount = 0;
        const maxRetries = 10;

        const connect = () => {
            const devtools = (window as any).__QUANTA_DEVTOOLS__;
            if (devtools) {
                console.log('[Quanta DevTools] Connected to bridge');
                unsubscribe = devtools.subscribe(handleEvent);
            } else if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(connect, 500);
            } else {
                console.warn(
                    '[Quanta DevTools] Failed to connect to bridge after retries',
                );
            }
        };

        const handleEvent = (event: any) => {
            if (event.type === 'STORE_INIT') {
                setStores((prev) => {
                    const newStores = {
                        ...prev,
                        [event.payload.name]: event.payload.store,
                    };
                    // Auto-select first store
                    if (!selectedStore) setSelectedStore(event.payload.name);
                    return newStores;
                });
            } else if (event.type === 'STATE_CHANGE') {
                setStores((prev) => {
                    // We need to create a deep copy or update the specific path
                    // For now, let's just shallow copy the store state to trigger re-render
                    // In a real app, we might want to apply the patch
                    const storeName = event.payload.storeName;
                    // const currentStoreState = prev[storeName];

                    // This is a simplification. Since the state in core is a Proxy,
                    // reading it here might be tricky if we don't have a snapshot.
                    // However, the payload value is the new value.
                    // But we want the WHOLE state.
                    // The `stores` state here should ideally be a snapshot.

                    // Since we are in the same context, `prev[storeName]` IS the reactive object (or proxy).
                    // React might not detect changes if we just return the same object.
                    // We need to force update.

                    // We need to update the state property of the specific store
                    if (prev[storeName]) {
                        // We can't easily replace the proxy, but we can trigger a re-render
                        // by creating a new object for the stores map.
                        // The state object itself is mutated in place (it's a proxy/reactive).
                        return { ...prev };
                    }
                    return prev;
                });
            } else if (event.type === 'ACTION_CALL') {
                setActions((prev) => [
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        storeName: event.payload.storeName,
                        actionName: event.payload.actionName,
                        args: event.payload.args,
                        timestamp: Date.now(),
                    },
                    ...prev.slice(0, 49), // Keep last 50 actions
                ]);
            }
        };

        connect();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [selectedStore]);

    return { stores, actions, selectedStore, setSelectedStore };
}
