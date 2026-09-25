<script lang="ts">
    import {
        shallow,
        useQuanta,
        useQuantaActions,
        useQuantaValue,
    } from '@quantajs/svelte';
    import { useTodos } from './stores';

    // Notifies only when the owner or the count left changes.
    const summary = useQuantaValue(
        useTodos,
        (s) => ({ owner: s.owner, remaining: s.remaining }),
        { equalityFn: shallow },
    );
    // An action's reactive state.
    const loading = useQuantaValue(useTodos, (s) => s.load.pending);
    // The whole store, for the list.
    const todos = useQuanta(useTodos);
    // Actions only: never subscribes.
    const actions = useQuantaActions(useTodos);
</script>

<h1 data-owner>{$summary.owner || 'nobody'}</h1>
<p data-remaining>{$summary.remaining} left</p>
{#if $loading}<p>Loading…</p>{/if}
<ul>
    {#each $todos.items as todo (todo.id)}
        <li>
            <label>
                <input
                    type="checkbox"
                    checked={todo.done}
                    onchange={() => actions.toggle(todo.id)}
                />
                {todo.text}
            </label>
        </li>
    {/each}
</ul>
<button onclick={() => actions.add('New todo')}>Add</button>
<button onclick={() => actions.load('you', 500)}>Reload</button>
