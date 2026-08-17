/**
 * Guards for merging untrusted data into reactive state.
 *
 * Anything that arrives from outside the running program — a persistence
 * adapter, a `storage` event from another tab, a server payload — is untrusted
 * input. `JSON.parse` creates a real *own* `__proto__` property (unlike an
 * object literal, where `__proto__` invokes the accessor on `Object.prototype`),
 * and a naive `for...in` copy therefore hands an attacker control of the target
 * object's prototype:
 *
 * ```js
 * const hostile = JSON.parse('{"__proto__":{"isAdmin":true}}');
 * for (const k in hostile) target[k] = hostile[k];  // prototype replaced
 * ```
 *
 * These helpers are the single choke point for that class of bug. Every
 * external-data ingest path in the library must go through them.
 */

/**
 * Property names that must never be copied from untrusted input.
 *
 * - `__proto__`    — assignment replaces the target's prototype.
 * - `constructor`  — a stepping stone to `constructor.prototype`.
 * - `prototype`    — pollutes function-valued targets.
 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Whether `key` is safe to copy from an untrusted source.
 */
export function isSafeKey(key: string | symbol): boolean {
    return typeof key === 'symbol' || !FORBIDDEN_KEYS.has(key);
}

/**
 * Recursively strip dangerous keys from a parsed payload.
 *
 * Returns a structurally-equivalent value with every `__proto__` /
 * `constructor` / `prototype` own property removed at every depth. Non-plain
 * values (primitives, `Date`, class instances) are returned as-is — only plain
 * objects and arrays are rebuilt, so the copy stays cheap for typical payloads.
 *
 * @param value - Untrusted, already-parsed data.
 * @param seen  - Internal cycle guard.
 * @returns A sanitized copy safe to merge into application state.
 */
export function sanitizePayload<T>(value: T, seen = new WeakSet<object>()): T {
    if (value === null || typeof value !== 'object') return value;

    const asObject = value as unknown as object;

    // A cycle cannot come from JSON.parse, but a custom `deserialize` may
    // produce one. Collapse it rather than overflowing the stack.
    if (seen.has(asObject)) return undefined as unknown as T;
    seen.add(asObject);

    if (Array.isArray(value)) {
        const out = value.map((item) => sanitizePayload(item, seen));
        seen.delete(asObject);
        return out as unknown as T;
    }

    // Leave exotic objects (Date, Map, Set, class instances) intact: they carry
    // no own `__proto__` key from a JSON parse, and rebuilding them would lose
    // their identity and behaviour.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
        seen.delete(asObject);
        return value;
    }

    const out: Record<string, unknown> = {};
    // `Object.keys` reports own enumerable string keys, which is exactly the
    // set `for...in` would copy minus inherited ones.
    for (const key of Object.keys(value as Record<string, unknown>)) {
        if (!isSafeKey(key)) continue;
        out[key] = sanitizePayload(
            (value as Record<string, unknown>)[key],
            seen,
        );
    }
    seen.delete(asObject);
    return out as unknown as T;
}

/**
 * A `JSON.parse` reviver that drops dangerous keys during parsing.
 *
 * Cheaper than {@link sanitizePayload} because it avoids a second full walk,
 * but it only helps when the caller controls the `JSON.parse` call. Exposed so
 * that users supplying a custom `deserialize` can opt into the same protection:
 *
 * ```ts
 * persist: { deserialize: (raw) => JSON.parse(raw, safeJsonReviver) }
 * ```
 */
export function safeJsonReviver(key: string, value: unknown): unknown {
    return isSafeKey(key) ? value : undefined;
}

/**
 * Parse JSON with prototype-pollution protection. This is the library's
 * default `deserialize` implementation.
 */
export function safeJsonParse(raw: string): unknown {
    return JSON.parse(raw, safeJsonReviver);
}
