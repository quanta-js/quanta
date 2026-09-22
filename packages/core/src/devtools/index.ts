import { logger } from '../services/logger-service';
import { __DEV__, isBrowser } from '../utils/env';
import { toRaw } from '../core/create-reactive';
import { getParentChain } from '../utils/deep-trigger';
import {
    setDevToolsSink,
    registerStore,
    unregisterStore,
    registeredStore,
    registeredStores,
    type DevToolsSink,
} from './hook';

export type DevToolsEvent =
    | { type: 'STORE_INIT'; payload: { name: string; store: unknown } }
    | { type: 'STORE_DISPOSE'; payload: { name: string } }
    | {
          type: 'STATE_CHANGE';
          payload: {
              storeName: string;
              path: string;
              value: unknown;
              timestamp: number;
          };
      }
    | {
          type: 'ACTION_CALL';
          payload: {
              storeName: string;
              actionName: string;
              args: unknown[];
              timestamp: number;
          };
      };

type DevToolsListener = (event: DevToolsEvent) => void;

export interface DevToolsOptions {
    /**
     * Property paths to redact from emitted events, e.g. `['token', 'user.ssn']`.
     * Redaction applies to state values and to action arguments that are
     * objects carrying a matching key.
     */
    redact?: string[];
}

const REDACTED = '[redacted]';

/**
 * The bridge between the reactive core and any DevTools UI.
 *
 * ## Security posture
 *
 * DevTools observes *everything*: full store contents and every argument
 * passed to every action — which routinely includes credentials, tokens and
 * personal data. It is therefore **opt-in**, and the bridge is only attached
 * to `window` once it has been enabled.
 *
 * The previous implementation enabled itself by default whenever
 * `process.env.NODE_ENV` was not statically replaced (CDN builds, Deno, plain
 * `<script type="module">`) and attached itself to `window` unconditionally at
 * import time, which exposed all application state to any script on the page
 * in production.
 */
class DevToolsBridge implements DevToolsSink {
    private listeners = new Set<DevToolsListener>();

    /**
     * Raw state object -> store name.
     *
     * Keyed by the **raw** target, not the proxy. The proxy traps report
     * mutations against the raw object they close over, so a proxy-keyed map
     * never matched and no state change was ever reported. Both are registered
     * defensively; `resolve()` normalises with `toRaw` regardless.
     */
    private stateMap = new WeakMap<object, string>();

    private _enabled = false;
    private redactions: string[] = [];

    /** Whether events are being emitted. */
    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(value: boolean) {
        if (value) {
            this.enable();
        } else {
            this._enabled = false;
            setDevToolsSink(null);
        }
    }

    /**
     * Turn DevTools on and expose the bridge for an external UI to attach to.
     *
     * Call this yourself in development:
     * ```ts
     * if (import.meta.env.DEV) enableDevTools();
     * ```
     */
    enable(options: DevToolsOptions = {}): void {
        this._enabled = true;
        if (options.redact) this.redactions = options.redact;
        for (const [name, store] of registeredStores()) {
            this.indexState(name, store);
        }
        setDevToolsSink(this);

        // Attach only now — never as an import side effect.
        if (isBrowser()) {
            (window as unknown as Record<string, unknown>).__QUANTA_DEVTOOLS__ =
                this;
        }
    }

    /** Turn DevTools off and remove the global handle. */
    disable(): void {
        this._enabled = false;
        setDevToolsSink(null);
        if (isBrowser()) {
            delete (window as unknown as Record<string, unknown>)
                .__QUANTA_DEVTOOLS__;
        }
    }

    /**
     * Emit an event to every listener.
     *
     * Each listener is isolated: `notifyStateChange` runs *inside* the reactive
     * `set` trap, so an exception escaping here would break the application's
     * ability to write state. A broken DevTools panel must never take the app
     * with it.
     */
    emit(event: DevToolsEvent): void {
        if (!this._enabled || this.listeners.size === 0) return;
        for (const listener of [...this.listeners]) {
            try {
                listener(event);
            } catch (error) {
                if (__DEV__) {
                    logger.warn(
                        `DevTools: listener threw and was ignored: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    );
                }
            }
        }
    }

    /** Subscribe to the event stream; existing stores are replayed. */
    subscribe(listener: DevToolsListener): () => void {
        this.listeners.add(listener);
        for (const [name, store] of registeredStores()) {
            try {
                listener({ type: 'STORE_INIT', payload: { name, store } });
            } catch (error) {
                if (__DEV__) {
                    logger.warn(
                        `DevTools: listener threw during replay: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    );
                }
            }
        }
        return () => {
            this.listeners.delete(listener);
        };
    }

    /** Record a store. The core calls this for every store it creates. */
    registerStore(name: string, store: { state?: object }): void {
        registerStore(name, store);
    }

    /** Forget a store, by default whichever one holds `name`. */
    unregisterStore(name: string, instance?: object): void {
        const store = instance ?? registeredStore(name);
        if (store !== undefined) unregisterStore(name, store);
    }

    /** Map a store's state to its name, for resolving mutation paths. */
    private indexState(name: string, store: object): void {
        const state = (store as { state?: object }).state;
        if (!state) return;
        // The raw target is the identity the proxy traps report against;
        // the proxy is registered too for direct lookups by tooling.
        this.stateMap.set(toRaw(state), name);
        this.stateMap.set(state, name);
    }

    /* DevToolsSink: installed by enable(), called by the core. */

    storeRegistered(name: string, store: object): void {
        this.indexState(name, store);
        this.emit({ type: 'STORE_INIT', payload: { name, store } });
    }

    storeDisposed(name: string, store: object): void {
        const state = (store as { state?: object }).state;
        if (state) {
            this.stateMap.delete(toRaw(state));
            this.stateMap.delete(state);
        }
        this.emit({ type: 'STORE_DISPOSE', payload: { name } });
    }

    stateChanged(target: object, prop: string | symbol, value: unknown): void {
        this.notifyStateChange(target, prop, value);
    }

    actionCalled(storeName: string, actionName: string, args: unknown[]): void {
        this.notifyActionCall(storeName, actionName, args);
    }

    /**
     * A plain copy of a store's state and getter values, with the configured
     * `redact` paths masked. This is what a panel should display: rendering
     * the live store would bypass redaction.
     */
    snapshot(
        name: string,
    ): { state: unknown; getters: Record<string, unknown> } | undefined {
        const store = registeredStore(name) as
            | {
                  state?: object;
                  getters?: Record<string, { value: unknown }>;
              }
            | undefined;
        if (!store) return undefined;

        const getters: Record<string, unknown> = {};
        for (const key of Object.keys(store.getters ?? {})) {
            let value: unknown;
            try {
                value = store.getters![key].value;
            } catch (error) {
                value = `[threw: ${error instanceof Error ? error.message : String(error)}]`;
            }
            getters[key] = redactTree(key, value, this.redactions);
        }
        return {
            state: redactTree('', toRaw(store.state), this.redactions),
            getters,
        };
    }

    /** The store a given state object belongs to, if any. */
    getStoreName(state: object): string | undefined {
        return this.stateMap.get(toRaw(state));
    }

    /**
     * Report a mutation, resolving it to a `store.path.to.prop` string.
     *
     * Walks up the parent chain recorded by the reactivity system until it
     * reaches a registered root.
     */
    notifyStateChange(
        target: object,
        prop: string | symbol,
        value: unknown,
    ): void {
        if (!this._enabled || this.listeners.size === 0) return;

        const raw = toRaw(target);
        const segments: string[] = [String(prop)];

        let storeName = this.stateMap.get(raw);
        if (storeName === undefined) {
            // `getParentChain` returns root-first, but the path is built by
            // prepending each ancestor's key as we climb — so walk it
            // leaf-first and stop at the first registered root.
            const chain = getParentChain(raw);
            for (let i = chain.length - 1; i >= 0; i--) {
                const link = chain[i];
                segments.unshift(String(link.key));
                const found = this.stateMap.get(toRaw(link.parent));
                if (found !== undefined) {
                    storeName = found;
                    break;
                }
            }
        }

        if (storeName === undefined) return; // not part of a registered store

        const path = segments.join('.');
        this.emit({
            type: 'STATE_CHANGE',
            payload: {
                storeName,
                path,
                value: this.redact(path, value),
                timestamp: Date.now(),
            },
        });
    }

    notifyActionCall(
        storeName: string,
        actionName: string,
        args: unknown[],
    ): void {
        if (!this._enabled || this.listeners.size === 0) return;
        this.emit({
            type: 'ACTION_CALL',
            payload: {
                storeName,
                actionName,
                args:
                    this.redactions.length > 0
                        ? args.map(redactDeep(this.redactions))
                        : args,
                timestamp: Date.now(),
            },
        });
    }

    /** Mask a changed value, including matching keys nested inside it. */
    private redact(path: string, value: unknown): unknown {
        if (this.redactions.length === 0) return value;
        return redactTree(path, value, this.redactions);
    }
}

/** Whether a dotted path matches a redaction pattern. */
function matches(path: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
        if (path === pattern || path.endsWith(`.${pattern}`)) return true;
    }
    return false;
}

/**
 * Copy a value into plain data, masking any path that matches a pattern.
 * Proxies are unwrapped, cycles are cut and depth is bounded.
 */
function redactTree(
    path: string,
    value: unknown,
    patterns: string[],
    seen = new WeakSet<object>(),
    depth = 0,
): unknown {
    if (path !== '' && matches(path, patterns)) return REDACTED;
    if (value === null || typeof value !== 'object') return value;

    const raw = toRaw(value) as object;
    if (seen.has(raw) || depth > 32) return '[circular]';
    seen.add(raw);

    const child = (key: string) => (path === '' ? key : `${path}.${key}`);
    let out: unknown;
    if (Array.isArray(raw)) {
        out = raw.map((item, i) =>
            redactTree(child(String(i)), item, patterns, seen, depth + 1),
        );
    } else if (raw instanceof Map) {
        const copy = new Map();
        for (const [key, item] of raw) {
            copy.set(
                key,
                redactTree(child(String(key)), item, patterns, seen, depth + 1),
            );
        }
        out = copy;
    } else if (raw instanceof Set) {
        out = new Set(
            [...raw].map((item, i) =>
                redactTree(child(String(i)), item, patterns, seen, depth + 1),
            ),
        );
    } else if (
        Object.getPrototypeOf(raw) === Object.prototype ||
        Object.getPrototypeOf(raw) === null
    ) {
        const copy: Record<string, unknown> = {};
        for (const key of Object.keys(raw)) {
            copy[key] = redactTree(
                child(key),
                (raw as Record<string, unknown>)[key],
                patterns,
                seen,
                depth + 1,
            );
        }
        out = copy;
    } else {
        // Dates, class instances and the like are shown as they are.
        out = raw;
    }
    seen.delete(raw);
    return out;
}

/** Redact matching keys anywhere inside an action argument. */
function redactDeep(patterns: string[]) {
    const keys = new Set(patterns.map((p) => p.split('.').pop()!));
    return function walk(value: unknown, depth = 0): unknown {
        if (depth > 8 || value === null || typeof value !== 'object') {
            return value;
        }
        if (Array.isArray(value)) return value.map((v) => walk(v, depth + 1));
        const out: Record<string, unknown> = {};
        for (const [key, inner] of Object.entries(
            value as Record<string, unknown>,
        )) {
            out[key] = keys.has(key) ? REDACTED : walk(inner, depth + 1);
        }
        return out;
    };
}

export const devtools = new DevToolsBridge();

/**
 * Enable DevTools instrumentation.
 *
 * Opt-in by design — see the security note on {@link DevToolsBridge}. Guard it
 * so it is stripped from production bundles:
 *
 * ```ts
 * if (import.meta.env.DEV) enableDevTools({ redact: ['token'] });
 * ```
 */
export function enableDevTools(options?: DevToolsOptions): void {
    devtools.enable(options);
}

/** Disable DevTools and remove the `window.__QUANTA_DEVTOOLS__` handle. */
export function disableDevTools(): void {
    devtools.disable();
}
