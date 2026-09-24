import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { createContainer, type StoreContainer } from '@quantajs/core';

/**
 * The context key for a component tree's store container, following the
 * web components community context protocol.
 *
 * Its type has the same shape as `@lit/context`'s `Context`, so it works with
 * `ContextProvider` and `@provide` from that package as well as with
 * {@link provideQuantaContainer}. A registered symbol keeps it identical
 * across duplicate copies of this package.
 */
export const quantaContainerContext = Symbol.for(
    'quantajs.container',
) as QuantaContainerContext;

export type QuantaContainerContext = symbol & { __context__: StoreContainer };

type Callback = (value: StoreContainer, unsubscribe?: () => void) => void;

/** Whether the host can take part in DOM events, which elements can. */
function asElement(host: ReactiveControllerHost): HTMLElement | null {
    const candidate = host as Partial<HTMLElement>;
    return typeof candidate.dispatchEvent === 'function' &&
        typeof candidate.addEventListener === 'function'
        ? (host as unknown as HTMLElement)
        : null;
}

/**
 * Ask the element's ancestors for a container. Resolves synchronously when a
 * provider above it is connected; `undefined` means none answered.
 */
export function requestQuantaContainer(
    host: ReactiveControllerHost,
): StoreContainer | undefined {
    const element = asElement(host);
    if (element === null || typeof Event === 'undefined') return undefined;

    let found: StoreContainer | undefined;
    const event = new Event('context-request', {
        bubbles: true,
        composed: true,
    }) as Event & {
        context: QuantaContainerContext;
        contextTarget: Element;
        callback: Callback;
        subscribe: boolean;
    };
    event.context = quantaContainerContext;
    event.contextTarget = element;
    event.callback = (value) => {
        found = value;
    };
    event.subscribe = false;
    element.dispatchEvent(event);
    return found;
}

class ContainerProvider implements ReactiveController {
    private pending: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private readonly element: HTMLElement,
        readonly container: StoreContainer,
        private readonly owned: boolean,
    ) {
        element.addEventListener('context-request', this.onRequest);
    }

    private onRequest = (event: Event) => {
        const request = event as Event & {
            context?: unknown;
            callback?: Callback;
        };
        if (request.context !== quantaContainerContext) return;
        event.stopPropagation();
        request.callback?.(this.container);
    };

    hostConnected() {
        if (this.pending !== null) {
            clearTimeout(this.pending);
            this.pending = null;
        }
    }

    hostDisconnected() {
        if (!this.owned) return;
        // Moving an element disconnects and reconnects it in one task; only
        // dispose when it stays disconnected.
        this.pending = setTimeout(() => {
            this.pending = null;
            if (!this.element.isConnected) this.container.dispose();
        }, 0);
    }
}

/**
 * Resolve stores in this element's subtree against a container. Call it in
 * the constructor of an element near the root of the tree.
 *
 * Without `container`, one is created and disposed when the element is
 * removed; pass your own to control its lifetime.
 *
 * @returns The container now provided.
 */
export function provideQuantaContainer(
    host: ReactiveControllerHost & HTMLElement,
    container?: StoreContainer,
): StoreContainer {
    const provided = container ?? createContainer('lit');
    host.addController(
        new ContainerProvider(host, provided, container === undefined),
    );
    return provided;
}
