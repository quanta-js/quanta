export type DevToolsEvent =
    | { type: 'STORE_INIT'; payload: { name: string; store: any } }
    | {
          type: 'STATE_CHANGE';
          payload: { storeName: string; path: string; value: any };
      }
    | {
          type: 'ACTION_CALL';
          payload: { storeName: string; actionName: string; args: any[] };
      };

type DevToolsListener = (event: DevToolsEvent) => void;

class DevToolsBridge {
    private listeners: Set<DevToolsListener> = new Set();
    private stores: Map<string, any> = new Map();
    private stateMap: WeakMap<object, string> = new WeakMap();

    /** Enable/disable devtools event emission (disable in production for zero overhead) */
    private _enabled = true;

    get enabled() {
        return this._enabled;
    }

    set enabled(value: boolean) {
        this._enabled = value;
    }

    emit(event: DevToolsEvent) {
        if (!this._enabled) return;
        this.listeners.forEach((listener) => listener(event));
    }

    subscribe(listener: DevToolsListener) {
        this.listeners.add(listener);
        // Replay init events for existing stores
        this.stores.forEach((store, name) => {
            listener({ type: 'STORE_INIT', payload: { name, store } });
        });
        return () => {
            this.listeners.delete(listener);
        };
    }

    registerStore(name: string, store: any) {
        if (!this._enabled) return;
        this.stores.set(name, store);
        if (store.state) {
            this.stateMap.set(store.state, name);
        }
        this.emit({ type: 'STORE_INIT', payload: { name, store } });
    }

    getStoreName(state: object): string | undefined {
        return this.stateMap.get(state);
    }

    notifyStateChange(
        target: object,
        prop: string | symbol,
        value: any,
        parentMap?: WeakMap<object, any>,
    ) {
        if (!this._enabled || this.listeners.size === 0) return;

        // Try to find the root and path
        let current = target;
        const path: string[] = [String(prop)];
        let storeName = this.stateMap.get(current);

        // Traverse up if we have a parent map and haven't found the store yet
        if (!storeName && parentMap) {
            let depth = 0;
            const maxDepth = 50;

            while (!storeName && depth < maxDepth) {
                const parentInfo = parentMap.get(current);
                if (!parentInfo) break;

                path.unshift(String(parentInfo.key));
                current = parentInfo.parent;
                storeName = this.stateMap.get(current);
                depth++;
            }
        }

        if (storeName) {
            this.emit({
                type: 'STATE_CHANGE',
                payload: {
                    storeName,
                    path: path.join('.'),
                    value,
                },
            });
        }
    }

    notifyActionCall(storeName: string, actionName: string, args: any[]) {
        if (!this._enabled || this.listeners.size === 0) return;
        this.emit({
            type: 'ACTION_CALL',
            payload: { storeName, actionName, args },
        });
    }
}

export const devtools = new DevToolsBridge();

// Expose on window for external tools if needed
if (typeof window !== 'undefined') {
    (window as any).__QUANTA_DEVTOOLS__ = devtools;
}
