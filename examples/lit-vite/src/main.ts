import { LitElement, html } from 'lit';
import {
    QuantaActionsController,
    QuantaController,
    QuantaLocalController,
    QuantaValueController,
    provideQuantaContainer,
    shallow,
} from '@quantajs/lit';
import { useCounter, useTodos } from './stores';

/** The app root: its subtree resolves stores against its own container. */
export class TodoApp extends LitElement {
    constructor() {
        super();
        provideQuantaContainer(this);
    }

    render() {
        return html`
            <todo-summary></todo-summary>
            <todo-list></todo-list>
            <todo-actions></todo-actions>
            <local-counter></local-counter>
            <local-counter></local-counter>
        `;
    }
}

/** Updates only when the owner or the count left changes. */
export class TodoSummary extends LitElement {
    private summary = new QuantaValueController(
        this,
        useTodos,
        (s) => ({ owner: s.owner, remaining: s.remaining }),
        { equalityFn: shallow },
    );
    private loading = new QuantaValueController(
        this,
        useTodos,
        (s) => s.load.pending,
    );

    render() {
        const { owner, remaining } = this.summary.value;
        return html`
            <h1 data-owner>${owner || 'nobody'}</h1>
            <p data-remaining>${remaining} left</p>
            ${this.loading.value ? html`<p>Loading…</p>` : null}
        `;
    }
}

/** Updates on any change to the store. */
export class TodoList extends LitElement {
    private todos = new QuantaController(this, useTodos);

    render() {
        const store = this.todos.store;
        return html`<ul>
            ${store.items.map(
                (todo) =>
                    html`<li>
                        <label>
                            <input
                                type="checkbox"
                                .checked=${todo.done}
                                @change=${() => store.toggle(todo.id)}
                            />
                            ${todo.text}
                        </label>
                    </li>`,
            )}
        </ul>`;
    }
}

/** Calls actions and never updates. */
export class TodoActions extends LitElement {
    private actions = new QuantaActionsController(this, useTodos);

    render() {
        return html`
            <button @click=${() => this.actions.store.add('New todo')}>
                Add
            </button>
            <button @click=${() => this.actions.store.load('you', 500)}>
                Reload
            </button>
        `;
    }
}

/** Each instance owns a separate store. */
export class LocalCounter extends LitElement {
    private counter = new QuantaLocalController(this, useCounter);

    render() {
        return html`<button data-local @click=${() => this.counter.store.inc()}>
            local ${this.counter.store.count}
        </button>`;
    }
}

customElements.define('todo-summary', TodoSummary);
customElements.define('todo-list', TodoList);
customElements.define('todo-actions', TodoActions);
customElements.define('local-counter', LocalCounter);
customElements.define('todo-app', TodoApp);
