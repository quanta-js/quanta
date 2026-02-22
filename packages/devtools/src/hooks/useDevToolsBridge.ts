import { useState, useEffect, useRef } from 'preact/hooks';

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
    const selectedStoreRef = useRef(selectedStore);

    // Keep ref in sync so the effect closure has the latest value
    selectedStoreRef.current = selectedStore;

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        let retryCount = 0;
        const maxRetries = 10;

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
                setStores((prev) => {
                    const storeName = event.payload.storeName;
                    if (prev[storeName]) {
                        // Force re-render by creating a new reference
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
                    ...prev.slice(0, 99), // Keep last 100 actions
                ]);
            }
        };

        const connect = () => {
            const devtools = (window as any).__QUANTA_DEVTOOLS__;
            if (devtools) {
                unsubscribe = devtools.subscribe(handleEvent);
            } else if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(connect, 500);
            }
        };

        connect();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []); // No dependency on selectedStore — uses ref instead

    return { stores, actions, selectedStore, setSelectedStore };
}
