import { createContainer, watch } from '@quantajs/core';
import { useCounterStore, useTodoStore } from './stores';
import { mountReactivityPlayground } from './reactivity';

/* --- Two isolated counters -------------------------------------------- *
 * Same store *definition*, two different containers: `resolve()` is
 * per-container, so bumping A never touches B. No provider, no framework —
 * this is the isolation `defineStore` buys you for free.
 */
function mountCounter(root: HTMLElement, label: string) {
    const container = createContainer(label);
    const counter = useCounterStore(container);

    root.innerHTML = `
        <p>count: <strong data-count>0</strong> (doubled: <span data-doubled>0</span>)</p>
        <button data-inc>+1</button>
        <button data-reset>reset</button>
    `;

    const countEl = root.querySelector('[data-count]')!;
    const doubledEl = root.querySelector('[data-doubled]')!;
    root.querySelector('[data-inc]')!.addEventListener('click', () =>
        counter.increment(),
    );
    root.querySelector('[data-reset]')!.addEventListener('click', () =>
        counter.reset(),
    );

    const render = () => {
        countEl.textContent = String(counter.count);
        doubledEl.textContent = String(counter.doubled);
    };
    counter.subscribe(render);
    render();
}

mountCounter(document.getElementById('counter-a')!, 'counter-a');
mountCounter(document.getElementById('counter-b')!, 'counter-b');

/* --- Todos: getters, an async action, and watch() ---------------------- */
function mountTodos(root: HTMLElement) {
    const todos = useTodoStore();

    root.innerHTML = `
        <form data-add>
            <input data-input placeholder="Add a todo" />
            <button type="submit">Add</button>
            <button type="button" data-seed>Seed (async)</button>
        </form>
        <p data-status class="muted"></p>
        <ul data-list></ul>
        <p class="muted"><span data-remaining></span> remaining</p>
    `;

    const list = root.querySelector<HTMLUListElement>('[data-list]')!;
    const input = root.querySelector<HTMLInputElement>('[data-input]')!;
    const remainingEl = root.querySelector('[data-remaining]')!;
    const statusEl = root.querySelector('[data-status]')!;

    root.querySelector('[data-add]')!.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        todos.add(text);
        input.value = '';
    });

    root.querySelector('[data-seed]')!.addEventListener('click', () => {
        void todos.seed();
    });

    // `watch` fires only when the tracked value actually changes — here just
    // the async action's `pending` flag, not on every todo mutation.
    watch(
        () => todos.seed.pending,
        (pending) => {
            statusEl.textContent = pending ? 'Seeding…' : '';
        },
    );

    const render = () => {
        list.innerHTML = '';
        for (const todo of todos.items) {
            const li = document.createElement('li');
            li.textContent = todo.text;
            li.className = todo.done ? 'done' : '';
            li.addEventListener('click', () => todos.toggle(todo.id));
            list.appendChild(li);
        }
        remainingEl.textContent = String(todos.remaining);
    };
    todos.subscribe(render);
    render();
}

mountTodos(document.getElementById('todos')!);
mountReactivityPlayground(document.getElementById('reactivity')!);
