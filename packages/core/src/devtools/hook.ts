/**
 * The seam between the core and DevTools.
 *
 * Stores and the reactive traps report through here rather than importing
 * the DevTools bridge, so an app that never calls `enableDevTools()` does not
 * ship it. The bridge installs itself as the sink when enabled.
 *
 * The store registry is kept even while DevTools is off, because DevTools is
 * usually enabled after the first stores exist. Stores are held weakly so an
 * undisposed container (on a server, one per request) can still be collected.
 */

export interface DevToolsSink {
    storeRegistered(name: string, store: object): void;
    storeDisposed(name: string, store: object): void;
    stateChanged(target: object, prop: string | symbol, value: unknown): void;
    actionCalled(storeName: string, actionName: string, args: unknown[]): void;
}

/** The enabled DevTools bridge, or null. */
export let devtoolsSink: DevToolsSink | null = null;

export function setDevToolsSink(sink: DevToolsSink | null): void {
    devtoolsSink = sink;
}

interface Ref<T extends object> {
    deref(): T | undefined;
}

const WeakRefCtor = (
    globalThis as { WeakRef?: new <T extends object>(target: T) => Ref<T> }
).WeakRef;

const registry = new Map<string, Ref<object>>();

/** Record a store; called for every store, whether DevTools is on or not. */
export function registerStore(name: string, store: object): void {
    // Without WeakRef, fall back to registering only while enabled.
    if (WeakRefCtor === undefined && devtoolsSink === null) return;
    registry.set(
        name,
        WeakRefCtor ? new WeakRefCtor(store) : { deref: () => store },
    );
    devtoolsSink?.storeRegistered(name, store);
}

/**
 * Forget a store. Another container may have registered a store under the
 * same name since, so only the entry for this instance is removed.
 */
export function unregisterStore(name: string, store: object): void {
    if (registry.get(name)?.deref() !== store) return;
    registry.delete(name);
    devtoolsSink?.storeDisposed(name, store);
}

/** A registered store that is still alive. */
export function registeredStore(name: string): object | undefined {
    const store = registry.get(name)?.deref();
    if (store === undefined) registry.delete(name);
    return store;
}

/** Every registered store that is still alive. */
export function registeredStores(): Array<[string, object]> {
    const live: Array<[string, object]> = [];
    for (const name of [...registry.keys()]) {
        const store = registeredStore(name);
        if (store !== undefined) live.push([name, store]);
    }
    return live;
}
