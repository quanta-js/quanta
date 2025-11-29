/**
 * Safely serialize objects that may contain circular references or non-serializable values
 */
export function safeSerialize(
    obj: any,
    maxDepth: number = 10,
    maxLength: number = 10000,
): string {
    const seen = new WeakSet();
    let currentLength = 0;

    function serialize(value: any, depth: number): any {
        // Check depth limit
        if (depth > maxDepth) {
            return '[Max Depth Reached]';
        }

        // Check length limit
        if (currentLength > maxLength) {
            return '[Max Length Exceeded]';
        }

        // Handle null and undefined
        if (value === null) return null;
        if (value === undefined) return '[undefined]';

        // Handle primitives
        const type = typeof value;
        if (type === 'string' || type === 'number' || type === 'boolean') {
            currentLength += String(value).length;
            return value;
        }

        // Handle functions
        if (type === 'function') {
            return `[Function: ${value.name || 'anonymous'}]`;
        }

        // Handle Window object
        if (typeof Window !== 'undefined' && value instanceof Window) {
            return '[Window]';
        }

        // Handle DOM nodes
        if (typeof Node !== 'undefined' && value instanceof Node) {
            if (value instanceof Element) {
                return `[Element: ${value.tagName}${value.id ? '#' + value.id : ''}]`;
            }
            return '[DOM Node]';
        }

        // Handle Dates
        if (value instanceof Date) {
            return value.toISOString();
        }

        // Handle RegExp
        if (value instanceof RegExp) {
            return value.toString();
        }

        // Handle Arrays
        if (Array.isArray(value)) {
            // Check for circular reference
            if (seen.has(value)) {
                return '[Circular Reference]';
            }
            seen.add(value);

            const result = value.map((item) => serialize(item, depth + 1));
            seen.delete(value);
            return result;
        }

        // Handle objects
        if (type === 'object') {
            // Check for circular reference
            if (seen.has(value)) {
                return '[Circular Reference]';
            }
            seen.add(value);

            const result: Record<string, any> = {};
            for (const key in value) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    result[key] = serialize(value[key], depth + 1);
                }
            }
            seen.delete(value);
            return result;
        }

        // Fallback for symbols and other types
        return `[${type}]`;
    }

    try {
        const serialized = serialize(obj, 0);
        return JSON.stringify(serialized, null, 2);
    } catch (error) {
        return `[Serialization Error: ${error instanceof Error ? error.message : 'Unknown'}]`;
    }
}

/**
 * Compact version without pretty printing
 */
export function safeSerializeCompact(obj: any): string {
    const seen = new WeakSet();

    function serialize(value: any, depth: number): any {
        if (depth > 10) return '[...]';
        if (value === null) return null;
        if (value === undefined) return undefined;

        const type = typeof value;
        if (type === 'string' || type === 'number' || type === 'boolean') {
            return value;
        }

        if (type === 'function') return '[Function]';

        if (typeof Window !== 'undefined' && value instanceof Window) {
            return '[Window]';
        }

        if (typeof Node !== 'undefined' && value instanceof Node) {
            return '[Element]';
        }

        if (value instanceof Date) return value.toISOString();
        if (value instanceof RegExp) return value.toString();

        if (Array.isArray(value)) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
            const result = value.map((item) => serialize(item, depth + 1));
            seen.delete(value);
            return result;
        }

        if (type === 'object') {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
            const result: Record<string, any> = {};
            for (const key in value) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    result[key] = serialize(value[key], depth + 1);
                }
            }
            seen.delete(value);
            return result;
        }

        return String(value);
    }

    try {
        return JSON.stringify(serialize(obj, 0));
    } catch (error) {
        return '[Error]';
    }
}
