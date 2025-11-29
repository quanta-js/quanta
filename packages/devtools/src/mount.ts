import { render, h } from 'preact';
import { DevTools } from './DevTools';
// @ts-ignore
import styles from './index.css?inline';

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
    const { target = 'body', visible } = options;

    // Determine visibility
    const shouldShow = visible !== undefined ? visible : isDev();

    if (!shouldShow) {
        return () => {}; // No-op cleanup
    }

    console.log('[Quanta DevTools] Mounting...');

    // Inject styles if not already present
    if (!document.getElementById('quanta-devtools-styles')) {
        const style = document.createElement('style');
        style.id = 'quanta-devtools-styles';
        style.innerHTML = styles;
        document.head.appendChild(style);
    }

    let rootElement: HTMLElement | null;

    if (typeof target === 'string') {
        rootElement = document.querySelector(target);
    } else {
        rootElement = target;
    }

    if (!rootElement) {
        console.error('[Quanta DevTools] Target element not found');
        return () => {};
    }

    // Create a container for the devtools
    const container = document.createElement('div');
    container.id = 'quanta-devtools-root';
    rootElement.appendChild(container);

    // Render using Preact
    render(h(DevTools, {}), container);

    // Return a cleanup function
    return () => {
        render(null, container); // Unmount in Preact
        container.remove();
    };
}
