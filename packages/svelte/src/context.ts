import { getContext, onDestroy, setContext } from 'svelte';
import {
    createContainer,
    type ContainerSnapshot,
    type StoreContainer,
} from '@quantajs/core';

const CONTAINER = Symbol('quanta.container');

export interface SetQuantaContainerOptions {
    /** State from `container.dehydrate()` on the server, applied at once. */
    snapshot?: ContainerSnapshot;
}

/**
 * Resolve stores in this component and its descendants against a container.
 * Call it while the component initialises, usually in the root layout.
 *
 * Without `container`, one is created and disposed when the component is
 * destroyed; pass your own to keep it, for example to dehydrate it after a
 * server render.
 *
 * @returns The container now in context.
 */
export function setQuantaContainer(
    container?: StoreContainer,
    options: SetQuantaContainerOptions = {},
): StoreContainer {
    const active = container ?? createContainer('svelte');
    if (container === undefined) onDestroy(() => active.dispose());
    if (options.snapshot !== undefined) active.hydrate(options.snapshot);
    setContext(CONTAINER, active);
    return active;
}

/**
 * The container set above the current component, or `undefined` for the
 * default container, including when called outside a component.
 */
export function getQuantaContainer(): StoreContainer | undefined {
    try {
        return getContext<StoreContainer | undefined>(CONTAINER);
    } catch {
        // Svelte throws when there is no component being initialised.
        return undefined;
    }
}
