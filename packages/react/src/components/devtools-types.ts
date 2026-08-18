/**
 * Props shared by the real DevTools panel and the barrel stub that replaced
 * it.
 *
 * These live in their own module so `src/index.ts` can re-export the type
 * without importing the module that holds the `import('@quantajs/devtools')`
 * call. Bundlers resolve that specifier statically, so anything reachable from
 * the barrel drags the optional peer into the build graph.
 */
export interface QuantaDevToolsProps {
    /**
     * Force the panel on or off. When omitted, the panel mounts only in a
     * development build.
     */
    visible?: boolean;
    /**
     * Property paths to mask in the panel, e.g. `['token', 'user.ssn']`.
     * DevTools reports full state and every action argument, so redact
     * anything sensitive before it reaches the panel.
     */
    redact?: string[];
}
