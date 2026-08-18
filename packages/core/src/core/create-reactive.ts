import { track, trigger, batchEffects } from './effect';
import { logger } from '../services/logger-service';
import { __DEV__ } from '../utils/env';
import {
    parentMap,
    setParent,
    removeParent,
    ANY_CHANGE,
} from '../utils/deep-trigger';

export { ANY_CHANGE };
import { devtools } from '../devtools';

/** Retrieves the raw target behind a proxy. */
export const RAW_SYMBOL = Symbol('quanta.raw');
/** Marks an object as permanently non-reactive. */
const SKIP_SYMBOL = Symbol('quanta.skip');
/** Marks a proxy as shallow (only top-level properties are reactive). */
const SHALLOW_SYMBOL = Symbol('quanta.shallow');
/** Marks a proxy as read-only. */
const READONLY_SYMBOL = Symbol('quanta.readonly');

/**
 * Synthetic dependency key representing "the set of own keys".
 *
 * `ownKeys` traps (`Object.keys`, `for...in`, spread, `JSON.stringify`)
 * subscribe to this key, and both adding and deleting a property publish to
 * it. A symbol is used rather than the string `'keys'` so it can never collide
 * with a real property name in user state.
 */
export const ITERATE_KEY = Symbol('quanta.iterate');

/**
 * Return the raw object behind a QuantaJS proxy.
 *
 * Use it to hand state to code that must not trigger tracking — a
 * serialiser, a third-party library, a deep-equality check in a hot loop.
 * Non-proxies are returned unchanged, so it is always safe to call.
 */
export function toRaw<T>(observed: T): T {
    if (observed === null || typeof observed !== 'object') return observed;
    const raw = (observed as Record<symbol, unknown>)[RAW_SYMBOL] as
        | T
        | undefined;
    return raw ? toRaw(raw) : observed;
}

/**
 * Permanently exclude an object from reactivity.
 *
 * Useful for large immutable payloads, class instances with internal
 * invariants, and third-party objects that misbehave behind a Proxy.
 *
 * @example
 * ```ts
 * state.chart = markRaw(new ExpensiveChartInstance());
 * ```
 */
export function markRaw<T extends object>(value: T): T {
    Object.defineProperty(value, SKIP_SYMBOL, {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false,
    });
    return value;
}

/** Whether `value` was marked with {@link markRaw}. */
function isMarkedRaw(value: object): boolean {
    return (value as Record<symbol, unknown>)[SKIP_SYMBOL] === true;
}

/** Array methods that mutate in place, intercepted so one call = one trigger. */
const ARRAY_MUTATORS = new Set([
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse',
    'fill',
    'copyWithin',
]);

/**
 * Built-ins that gain nothing from a Proxy and break subtly behind one
 * (internal slots are not forwarded through a `get` trap).
 */
function isNonReactiveBuiltin(target: object): boolean {
    return (
        target instanceof Date ||
        target instanceof RegExp ||
        target instanceof Error ||
        target instanceof Promise ||
        target instanceof WeakMap ||
        target instanceof WeakSet ||
        target instanceof ArrayBuffer ||
        (typeof SharedArrayBuffer !== 'undefined' &&
            target instanceof SharedArrayBuffer) ||
        ArrayBuffer.isView(target)
    );
}

/* ------------------------------------------------------------------ *
 * Proxy caches
 * ------------------------------------------------------------------ */

/** raw target -> its deep reactive proxy. */
const reactiveMap = new WeakMap<object, object>();
/** raw target -> its shallow reactive proxy. */
const shallowMap = new WeakMap<object, object>();
/** raw target -> its readonly proxy. */
const readonlyMap = new WeakMap<object, object>();
/** Every proxy we have handed out, so we never wrap a proxy in a proxy. */
const proxySet = new WeakSet<object>();

/** Whether `value` is a QuantaJS reactive proxy. */
export function isReactive(value: unknown): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        proxySet.has(value) &&
        (value as Record<symbol, unknown>)[READONLY_SYMBOL] !== true
    );
}

/** Whether `value` is a QuantaJS readonly proxy. */
export function isReadonly(value: unknown): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as Record<symbol, unknown>)[READONLY_SYMBOL] === true
    );
}

/** Whether `value` is any QuantaJS proxy (reactive, shallow or readonly). */
export function isProxy(value: unknown): boolean {
    return typeof value === 'object' && value !== null && proxySet.has(value);
}

interface ReactiveFlags {
    shallow: boolean;
    readonly: boolean;
}

const DEEP: ReactiveFlags = { shallow: false, readonly: false };

/* ------------------------------------------------------------------ *
 * Map / Set
 * ------------------------------------------------------------------ */

/**
 * Reactive wrapper for `Map` and `Set`.
 *
 * Collections cannot be proxied by property access — `map.get(k)` is a method
 * call, not a read of `k` — so each mutating and reading method is
 * instrumented to track and trigger against the key it touches.
 */
function createReactiveCollection(
    target: Map<unknown, unknown> | Set<unknown>,
    flags: ReactiveFlags,
): object {
    const cache = flags.readonly ? readonlyMap : reactiveMap;
    const cached = cache.get(target);
    if (cached) return cached;

    /** Wrap a value on the way out so nested mutations stay reactive. */
    const wrap = (value: unknown): unknown => {
        if (flags.shallow) return value;
        if (typeof value === 'object' && value !== null) {
            setParent(value as object, target, ITERATE_KEY);
        }
        return createReactive(value, flags);
    };

    const readonlyGuard = (op: string): boolean => {
        if (!flags.readonly) return false;
        if (__DEV__) {
            logger.warn(
                `Reactive: "${op}" was blocked on a readonly collection.`,
            );
        }
        return true;
    };

    const instrumentations: Record<string | symbol, unknown> = {
        get(key: unknown) {
            const rawKey = toRaw(key);
            track(target, rawKey as string | symbol);
            return wrap((target as Map<unknown, unknown>).get(rawKey));
        },

        has(key: unknown) {
            const rawKey = toRaw(key);
            track(target, rawKey as string | symbol);
            return target.has(rawKey);
        },

        add(key: unknown) {
            if (readonlyGuard('add')) return this;
            const rawKey = toRaw(key);
            const had = target.has(rawKey);
            (target as Set<unknown>).add(rawKey);
            if (!had) {
                if (typeof rawKey === 'object' && rawKey !== null) {
                    setParent(rawKey as object, target, ITERATE_KEY);
                }
                // One logical change, one flush.
                batchEffects(() => {
                    trigger(target, rawKey as string | symbol);
                    trigger(target, ITERATE_KEY);
                });
                notifyDevTools(target, rawKey, rawKey);
            }
            return this;
        },

        set(key: unknown, value: unknown) {
            if (readonlyGuard('set')) return this;
            const rawKey = toRaw(key);
            const rawValue = toRaw(value);
            const map = target as Map<unknown, unknown>;
            const had = map.has(rawKey);
            const oldValue = map.get(rawKey);

            if (had && Object.is(oldValue, rawValue)) return this;

            // The slot is being repointed: release the previous occupant so it
            // stops bubbling into this collection.
            if (had) removeParent(oldValue, target, ITERATE_KEY);

            map.set(rawKey, rawValue);
            if (typeof rawValue === 'object' && rawValue !== null) {
                setParent(rawValue as object, target, ITERATE_KEY);
            }

            batchEffects(() => {
                trigger(target, rawKey as string | symbol);
                // Size only changes on insert, but iterator-based subscribers
                // (forEach / entries / spread) must see value changes too.
                trigger(target, ITERATE_KEY);
            });
            notifyDevTools(target, rawKey, rawValue);
            return this;
        },

        delete(key: unknown) {
            if (readonlyGuard('delete')) return false;
            const rawKey = toRaw(key);
            const had = target.has(rawKey);
            if (!had) return false;

            const oldValue =
                target instanceof Map ? target.get(rawKey) : rawKey;
            const result = target.delete(rawKey);
            removeParent(oldValue, target, ITERATE_KEY);

            batchEffects(() => {
                trigger(target, rawKey as string | symbol);
                trigger(target, ITERATE_KEY);
            });
            notifyDevTools(target, rawKey, undefined);
            return result;
        },

        clear() {
            if (readonlyGuard('clear')) return undefined;
            if (target.size === 0) return undefined;

            const entries =
                target instanceof Map
                    ? [...target.entries()]
                    : [...target.values()].map((v) => [v, v] as const);

            target.clear();

            batchEffects(() => {
                trigger(target, ITERATE_KEY);
                for (const [key, value] of entries) {
                    removeParent(value, target, ITERATE_KEY);
                    trigger(target, key as string | symbol);
                }
            });
            notifyDevTools(target, ITERATE_KEY, undefined);
            return undefined;
        },

        forEach(callback: (...args: unknown[]) => void, thisArg?: unknown) {
            track(target, ITERATE_KEY);
            const isMap = target instanceof Map;
            return target.forEach((value: unknown, key: unknown) => {
                callback.call(
                    thisArg,
                    wrap(value),
                    // Map keys keep their identity so `map.get(keyFromForEach)`
                    // works; Set "keys" are values and are wrapped.
                    isMap ? key : wrap(key),
                    this,
                );
            });
        },
    };

    for (const method of ['keys', 'values', 'entries', Symbol.iterator]) {
        instrumentations[method as string] = function (...args: unknown[]) {
            track(target, ITERATE_KEY);
            const inner = (
                target as unknown as Record<
                    string | symbol,
                    (...a: unknown[]) => Iterator<unknown>
                >
            )[method as string](...args);
            const isMap = target instanceof Map;
            const yieldsEntries =
                method === 'entries' || (method === Symbol.iterator && isMap);

            return {
                next() {
                    const step = inner.next();
                    if (step.done) return step;
                    const value = step.value as unknown;
                    return {
                        done: false,
                        value: yieldsEntries
                            ? [
                                  (value as unknown[])[0],
                                  wrap((value as unknown[])[1]),
                              ]
                            : method === 'keys' && isMap
                              ? value
                              : wrap(value),
                    };
                },
                [Symbol.iterator]() {
                    return this;
                },
            };
        };
    }

    const proxy = new Proxy(target, {
        get(_obj, prop: string | symbol, receiver) {
            if (prop === RAW_SYMBOL) return target;
            if (prop === READONLY_SYMBOL) return flags.readonly;
            if (prop === SHALLOW_SYMBOL) return flags.shallow;

            if (prop === 'size') {
                track(target, ITERATE_KEY);
                return target.size;
            }

            const instrumented = instrumentations[prop];
            if (instrumented !== undefined) {
                return typeof instrumented === 'function'
                    ? instrumented.bind(receiver)
                    : instrumented;
            }

            track(target, prop);
            return Reflect.get(target, prop, target);
        },
    });

    cache.set(target, proxy);
    proxySet.add(proxy);
    return proxy;
}

/** Emit a DevTools event, never letting a listener break the mutation. */
/**
 * Objects known to hold only data properties, with a prototype that holds no
 * accessors either.
 *
 * Computed once per object and cached, because the answer cannot change for
 * the shapes that qualify: adding an accessor later goes through
 * `defineProperty`, which is not a path the reactive proxy exposes, and a
 * plain `x.foo = 1` write can only ever create a data property.
 */
const plainDataObjects = new WeakSet<object>();
const nonPlainObjects = new WeakSet<object>();

function isPlainDataObject(target: object): boolean {
    if (plainDataObjects.has(target)) return true;
    if (nonPlainObjects.has(target)) return false;

    let plain = true;

    // Own properties: any accessor disqualifies the object.
    for (const key of Reflect.ownKeys(target)) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        if (descriptor !== undefined && !('value' in descriptor)) {
            plain = false;
            break;
        }
    }

    // Prototype chain: an inherited setter is exactly the case the receiver
    // argument exists for. `Object.prototype` and `Array.prototype` are
    // treated as known-clean rather than walked on every new object.
    if (plain) {
        const proto = Object.getPrototypeOf(target);
        if (
            proto !== null &&
            proto !== Object.prototype &&
            proto !== Array.prototype
        ) {
            plain = false;
        }
    }

    (plain ? plainDataObjects : nonPlainObjects).add(target);
    return plain;
}

function notifyDevTools(
    target: object,
    prop: string | symbol | unknown,
    value: unknown,
): void {
    if (!devtools.enabled) return;
    devtools.notifyStateChange(target, prop as string | symbol, value);
}

/* ------------------------------------------------------------------ *
 * Objects & arrays
 * ------------------------------------------------------------------ */

/**
 * Wrap `target` in a reactive proxy.
 *
 * Primitives, `null`, non-proxyable built-ins and `markRaw`-ed objects pass
 * through unchanged, so callers never need to type-check first.
 */
export function createReactive<T>(target: T, flags: ReactiveFlags = DEEP): T {
    if (target === null || target === undefined) return target;
    if (typeof target !== 'object' && typeof target !== 'function') {
        return target;
    }

    const obj = target as unknown as object;

    // `markRaw` stays in front of the cache: it can be applied to an object
    // that was already made reactive, and it must win when it is. At ~0.6ns
    // for a symbol property read it costs nothing to keep here.
    if (isMarkedRaw(obj)) return target;

    const cache = flags.readonly
        ? readonlyMap
        : flags.shallow
          ? shallowMap
          : reactiveMap;

    // Cache first.
    //
    // Every nested property read reaches this function, and the overwhelming
    // majority are cache hits — the proxy for `state.user` is built once and
    // returned on every subsequent read of it. Running the guards ahead of the
    // lookup meant each of those hits paid for checks whose answer was already
    // settled: a cached proxy exists only because a previous call ran the very
    // same guards and passed them.
    //
    // Measured on a cache hit: guards-then-lookup 30.5ns, lookup-first 5.4ns,
    // against ~105ns for a whole nested read. The guards below still run on a
    // miss, which is once per object rather than once per read.
    const cached = cache.get(obj);
    if (cached) return cached as unknown as T;

    if (isNonReactiveBuiltin(obj)) return target;

    // Never wrap a proxy in another proxy: spreading a reactive array
    // (`[...items]`) would otherwise chain traps exponentially. A proxy is
    // never a cache key — only raw targets are — so this cannot be reached
    // through a hit above.
    if (proxySet.has(obj)) return target;

    if (obj instanceof Map || obj instanceof Set) {
        return createReactiveCollection(
            obj as Map<unknown, unknown> | Set<unknown>,
            flags,
        ) as unknown as T;
    }

    const proxy = new Proxy(obj as Record<string | symbol, unknown>, {
        get(source, prop: string | symbol, receiver) {
            if (prop === RAW_SYMBOL) return source;
            if (prop === READONLY_SYMBOL) return flags.readonly;
            if (prop === SHALLOW_SYMBOL) return flags.shallow;

            const result = Reflect.get(source, prop, receiver);

            // Intercept in-place array mutators so that the many index writes
            // and the implicit `length` update they perform collapse into a
            // single notification. `length` is triggered explicitly *inside*
            // the batch because the engine updates it before our set trap runs.
            if (
                Array.isArray(source) &&
                typeof result === 'function' &&
                typeof prop === 'string' &&
                ARRAY_MUTATORS.has(prop)
            ) {
                if (flags.readonly) {
                    return () => {
                        if (__DEV__) {
                            logger.warn(
                                `Reactive: "${prop}" was blocked on a readonly array.`,
                            );
                        }
                        return undefined;
                    };
                }
                return (...args: unknown[]) =>
                    batchEffects(() => {
                        const out = (
                            result as (...a: unknown[]) => unknown
                        ).apply(receiver, args);
                        trigger(source, 'length');
                        trigger(source, ITERATE_KEY);
                        return out;
                    });
            }

            track(source, prop);

            if (flags.shallow) return result;

            if (typeof result === 'object' && result !== null) {
                setParent(result, source, prop);
                return createReactive(result, flags);
            }

            return result;
        },

        set(source, prop: string | symbol, value: unknown, receiver) {
            if (flags.readonly) {
                if (__DEV__) {
                    logger.warn(
                        `Reactive: set of "${String(prop)}" was blocked on a readonly object.`,
                    );
                }
                return true; // silently ignore, matching Object.freeze semantics
            }

            // Assigning a proxy would store a proxy inside the raw target and
            // double-wrap on the way back out.
            const rawValue = toRaw(value);
            const hadKey = Object.prototype.hasOwnProperty.call(source, prop);
            const oldValue = source[prop];

            if (hadKey && Object.is(oldValue, rawValue)) return true;

            // The slot is being repointed: detach the previous occupant so it
            // no longer bubbles invalidations into this object.
            if (hadKey && oldValue !== rawValue) {
                removeParent(oldValue, source, prop);
            }

            // `Reflect.set(..., receiver)` re-enters this proxy's
            // getOwnPropertyDescriptor and defineProperty traps: measured at
            // ~209ns/write against ~21ns for a direct assignment.
            //
            // The receiver only matters when an accessor runs and needs `this`
            // bound to the proxy so that writes inside it stay tracked. For an
            // object with no accessors anywhere on its prototype chain there is
            // no accessor to run, and the direct write is observably identical.
            // {@link isPlainDataObject} decides that once per object rather
            // than paying for the check on every write.
            if (hadKey && isPlainDataObject(source)) {
                (source as Record<string | symbol, unknown>)[prop] = rawValue;
            } else {
                const result = Reflect.set(source, prop, rawValue, receiver);
                if (!result) return false;
            }

            if (typeof rawValue === 'object' && rawValue !== null) {
                setParent(rawValue, source, prop);
            }

            trigger(source, prop);
            // Adding a key changes the result of Object.keys / for...in /
            // spread / JSON.stringify, so enumeration subscribers must be
            // invalidated too. Only on add — a value change does not alter the
            // key set, and waking every enumerator on every write would be a
            // significant regression.
            if (!hadKey) trigger(source, ITERATE_KEY);

            notifyDevTools(source, prop, rawValue);
            return true;
        },

        deleteProperty(source, prop: string | symbol) {
            if (flags.readonly) {
                if (__DEV__) {
                    logger.warn(
                        `Reactive: delete of "${String(prop)}" was blocked on a readonly object.`,
                    );
                }
                return true;
            }

            const hadKey = Object.prototype.hasOwnProperty.call(source, prop);
            if (!hadKey) return true;

            const oldValue = source[prop];
            const result = Reflect.deleteProperty(source, prop);
            if (!result) return false;

            removeParent(oldValue, source, prop);
            trigger(source, prop);
            trigger(source, ITERATE_KEY);
            notifyDevTools(source, prop, undefined);
            return true;
        },

        has(source, prop: string | symbol) {
            track(source, prop);
            return Reflect.has(source, prop);
        },

        ownKeys(source) {
            // Arrays express their key set through `length`; everything else
            // uses the synthetic iterate key.
            track(source, Array.isArray(source) ? 'length' : ITERATE_KEY);
            return Reflect.ownKeys(source);
        },

        getOwnPropertyDescriptor(source, prop: string | symbol) {
            // Deliberately untracked: descriptor reads are an implementation
            // detail of spread and Object.keys, both of which already track
            // via ownKeys / get.
            return Reflect.getOwnPropertyDescriptor(source, prop);
        },
    });

    cache.set(obj, proxy);
    proxySet.add(proxy);
    return proxy as unknown as T;
}

/**
 * Reactive proxy where only top-level properties are tracked.
 *
 * Nested objects are returned raw. Use when state holds large structures whose
 * interiors never change identity — it avoids the cost of proxying the whole
 * tree.
 */
export function shallowReactive<T extends object>(target: T): T {
    return createReactive(target, { shallow: true, readonly: false }) as T;
}

/**
 * Read-only reactive view of `target`.
 *
 * Reads track as normal; writes are ignored and warned about in development.
 * Use to hand state to a consumer that must not mutate it.
 */
export function readonly<T extends object>(target: T): T {
    return createReactive(target, { shallow: false, readonly: true }) as T;
}

/** Read-only view that does not proxy nested values. */
export function shallowReadonly<T extends object>(target: T): T {
    return createReactive(target, { shallow: true, readonly: true }) as T;
}

export { parentMap };
