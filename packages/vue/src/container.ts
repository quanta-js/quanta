import {
    hasInjectionContext,
    inject,
    provide,
    type App,
    type InjectionKey,
} from 'vue';
import {
    createContainer,
    type ContainerSnapshot,
    type StoreContainer,
} from '@quantajs/core';

const CONTAINER: InjectionKey<StoreContainer> = Symbol('quanta.container');

export interface QuantaPluginOptions {
    /**
     * The container stores resolve against. When omitted, the plugin creates
     * one and disposes it when the app unmounts.
     */
    container?: StoreContainer;
    /** State from `container.dehydrate()` on the server, applied at once. */
    snapshot?: ContainerSnapshot;
}

export interface QuantaPlugin {
    /** The container this plugin provides to the app. */
    readonly container: StoreContainer;
    install(app: App): void;
}

/**
 * Give an app its own store container.
 *
 * Client-only apps can skip this and use the default container. A
 * server-rendered app must install it once per request, because the default
 * container is shared by every request the server handles.
 *
 * @example
 * ```ts
 * const app = createSSRApp(App);
 * app.use(createQuanta());
 * ```
 */
export function createQuanta(options: QuantaPluginOptions = {}): QuantaPlugin {
    const owned = options.container === undefined;
    const container = options.container ?? createContainer('vue');
    if (options.snapshot !== undefined) container.hydrate(options.snapshot);

    return {
        container,
        install(app) {
            app.provide(CONTAINER, container);
            // Only dispose a container created here: a supplied one belongs to
            // the caller. `onUnmount` arrived in Vue 3.5.
            if (owned) app.onUnmount?.(() => container.dispose());
        },
    };
}

/**
 * Resolve stores in this component and its descendants against `container`,
 * instead of the app's.
 */
export function provideQuantaContainer(container: StoreContainer): void {
    provide(CONTAINER, container);
}

/**
 * The container provided above the current component, or `undefined` for the
 * default container, including when called outside a component.
 */
export function useQuantaContainer(): StoreContainer | undefined {
    return hasInjectionContext() ? inject(CONTAINER, undefined) : undefined;
}
