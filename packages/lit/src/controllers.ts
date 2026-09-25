import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
    createContainer,
    untrack,
    watch,
    type ActionsTree,
    type GettersTree,
    type StateTree,
    type Store,
    type StoreContainer,
    type StoreDefinition,
} from '@quantajs/core';
import { requestQuantaContainer } from './context';

export interface ControllerOptions {
    /**
     * Resolve against this container instead of the one provided above the
     * element, or the default one when none is.
     */
    container?: StoreContainer;
}

export interface QuantaValueOptions<T> extends ControllerOptions {
    /**
     * Whether a new selection equals the previous one; the element updates
     * only when it returns false. Defaults to `Object.is` for primitives and
     * "changed" for objects, so in-place mutation still updates. Pass
     * `shallow` for a selector that builds a new object on each run.
     */
    equalityFn?: (a: T, b: T) => boolean;
}

/**
 * Only re-evaluated because something the selector read changed, so an object
 * that is still the same identity has been mutated in place.
 */
function selectionEquals<T>(a: T, b: T): boolean {
    if (typeof a === 'object' && a !== null) return false;
    if (typeof b === 'object' && b !== null) return false;
    return Object.is(a, b);
}

/**
 * Resolves a definition against the container for its host: the explicit
 * one, else the one provided above the element, else the default. It is
 * resolved again on every connection, since a moved element can land under
 * a different provider.
 *
 * Subclasses register with the host at the end of their own constructor:
 * Lit connects a controller at once when the host already is, which must not
 * happen before the subclass's fields exist.
 */
abstract class StoreBinding<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
> implements ReactiveController {
    private resolved: Store<S, G, A> | null = null;

    constructor(
        protected readonly host: ReactiveControllerHost,
        protected readonly definition: StoreDefinition<S, G, A>,
        protected readonly options: ControllerOptions = {},
    ) {}

    protected container(): StoreContainer | undefined {
        return this.options.container ?? requestQuantaContainer(this.host);
    }

    /**
     * The store. Before the element connects, and during server rendering,
     * it resolves against the explicit or default container.
     */
    get store(): Store<S, G, A> {
        this.resolved ??= this.definition(this.container());
        return this.resolved;
    }

    hostConnected(): void {
        this.resolved = this.definition(this.container());
    }

    hostDisconnected(): void {}
}

/**
 * A store's actions and state, without subscribing: the element does not
 * update when the store changes. For elements that only call actions.
 *
 * @example
 * ```ts
 * class AddTodo extends LitElement {
 *     private todos = new QuantaActionsController(this, useTodoStore);
 *     render() {
 *         return html`<button @click=${() => this.todos.store.add('New')}>Add</button>`;
 *     }
 * }
 * ```
 */
export class QuantaActionsController<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
> extends StoreBinding<S, G, A> {
    constructor(
        host: ReactiveControllerHost,
        definition: StoreDefinition<S, G, A>,
        options?: ControllerOptions,
    ) {
        super(host, definition, options);
        host.addController(this);
    }
}

/**
 * A store that updates its element on any change to it. For elements that
 * read most of a store; for a slice, prefer {@link QuantaValueController}.
 *
 * @example
 * ```ts
 * class TodoList extends LitElement {
 *     private todos = new QuantaController(this, useTodoStore);
 *     render() {
 *         return html`${this.todos.store.items.map((t) => html`<li>${t.text}</li>`)}`;
 *     }
 * }
 * ```
 */
export class QuantaController<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
> extends StoreBinding<S, G, A> {
    private unsubscribe: (() => void) | null = null;

    constructor(
        host: ReactiveControllerHost,
        definition: StoreDefinition<S, G, A>,
        options?: ControllerOptions,
    ) {
        super(host, definition, options);
        host.addController(this);
    }

    override hostConnected(): void {
        super.hostConnected();
        this.unsubscribe = this.store.subscribe(() =>
            this.host.requestUpdate(),
        );
    }

    override hostDisconnected(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }
}

/**
 * What `selector` reads from a store. The element updates only when the
 * state the selector read changes.
 *
 * @example
 * ```ts
 * class Remaining extends LitElement {
 *     private remaining = new QuantaValueController(
 *         this,
 *         useTodoStore,
 *         (s) => s.remaining,
 *     );
 *     render() {
 *         return html`${this.remaining.value} left`;
 *     }
 * }
 * ```
 */
export class QuantaValueController<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
    T,
> extends StoreBinding<S, G, A> {
    private stop: (() => void) | null = null;
    private current!: T;

    constructor(
        host: ReactiveControllerHost,
        definition: StoreDefinition<S, G, A>,
        private readonly selector: (store: Store<S, G, A>) => T,
        private readonly valueOptions: QuantaValueOptions<T> = {},
    ) {
        super(host, definition, valueOptions);
        host.addController(this);
    }

    /**
     * The selection. Tracked while the element is connected; before that,
     * and during server rendering, it is read directly.
     */
    get value(): T {
        if (this.stop !== null) return this.current;
        return untrack(() => this.selector(this.store));
    }

    override hostConnected(): void {
        super.hostConnected();
        const store = this.store;
        this.stop = watch(
            () => this.selector(store),
            (next) => {
                this.current = next;
                this.host.requestUpdate();
            },
            {
                immediate: true,
                equals: this.valueOptions.equalityFn ?? selectionEquals,
            },
        );
    }

    override hostDisconnected(): void {
        this.stop?.();
        this.stop = null;
    }
}

/**
 * A store of the element's own, in a container disposed when the element is
 * removed. Each instance gets a separate store, and a store survives the
 * element being moved in the DOM. Updates the element on any change.
 */
export class QuantaLocalController<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
> extends StoreBinding<S, G, A> {
    private own: StoreContainer | null = null;
    private pending: ReturnType<typeof setTimeout> | null = null;
    private unsubscribe: (() => void) | null = null;

    constructor(
        host: ReactiveControllerHost,
        definition: StoreDefinition<S, G, A>,
    ) {
        super(host, definition);
        host.addController(this);
    }

    protected override container(): StoreContainer {
        if (this.own === null || !this.own.active) {
            this.own = createContainer(`local_${this.definition.$id}`);
        }
        return this.own;
    }

    override hostConnected(): void {
        if (this.pending !== null) {
            clearTimeout(this.pending);
            this.pending = null;
        }
        super.hostConnected();
        this.unsubscribe = this.store.subscribe(() =>
            this.host.requestUpdate(),
        );
    }

    override hostDisconnected(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        const host = this.host as Partial<HTMLElement>;
        // Moving an element disconnects and reconnects it in one task; only
        // dispose when it stays disconnected.
        this.pending = setTimeout(() => {
            this.pending = null;
            if (host.isConnected !== true) this.own?.dispose();
        }, 0);
    }
}
