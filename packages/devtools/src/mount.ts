import { render, h } from 'preact';
import { DevTools } from './DevTools';
// @ts-ignore
import shadowStyles from './shadow-styles.css?inline';

export interface DevToolsOptions {
    /**
     * Whether to show the DevTools.
     * If not provided, it attempts to detect development environment.
     * Pass `true` to force show, `false` to force hide.
     */
    visible?: boolean;
    /**
     * The target element to mount into. Defaults to 'body'.
     */
    target?: HTMLElement | string;
    /**
     * Optional error callback for non-fatal mount issues.
     */
    onError?: (error: Error) => void;
}

function isDev(): boolean {
    // Check for Vite
    // @ts-ignore
    if (
        typeof import.meta !== 'undefined' &&
        import.meta.env &&
        import.meta.env.DEV
    ) {
        return true;
    }
    // Check for Node/Webpack
    // @ts-ignore
    if (
        typeof process !== 'undefined' &&
        process.env &&
        process.env.NODE_ENV === 'development'
    ) {
        return true;
    }
    return false;
}

export function mountDevTools(options: DevToolsOptions = {}) {
    const { target = 'body', visible, onError } = options;

    // Determine visibility
    const shouldShow = visible !== undefined ? visible : isDev();

    if (!shouldShow) {
        return () => {}; // No-op cleanup
    }

    let rootElement: HTMLElement | null;

    if (typeof target === 'string') {
        rootElement = document.querySelector(target);
    } else {
        rootElement = target;
    }

    if (!rootElement) {
        onError?.(new Error('Quanta DevTools target element not found'));
        return () => {};
    }

    // Create shadow host
    const shadowHost = document.createElement('div');
    shadowHost.id = 'quanta-devtools-shadow-host';

    // Attach shadow DOM
    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    // Inject Tailwind CSS into shadow DOM
    const styleSheet = document.createElement('style');
    styleSheet.textContent = shadowStyles;
    shadowRoot.appendChild(styleSheet);

    // Create app container
    const appRoot = document.createElement('div');
    appRoot.className = 'qdt';
    shadowRoot.appendChild(appRoot);

    // Append to target
    rootElement.appendChild(shadowHost);

    // Render Preact app
    render(h(DevTools, {}), appRoot);

    // Return cleanup
    return () => {
        render(null, appRoot);
        shadowHost.remove();
    };
}
