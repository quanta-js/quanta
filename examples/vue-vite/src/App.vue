<script setup lang="ts">
import {
    shallow,
    useQuanta,
    useQuantaActions,
    useQuantaValue,
} from '@quantajs/vue';
import { useTodos } from './stores';
import LocalCounter from './LocalCounter.vue';

// Updates only when the owner or the count left changes.
const summary = useQuantaValue(
    useTodos,
    (s) => ({ owner: s.owner, remaining: s.remaining }),
    { equalityFn: shallow },
);
// An action's reactive state.
const loading = useQuantaValue(useTodos, (s) => s.load.pending);
// The whole store, for the list.
const todos = useQuanta(useTodos);
// Actions only: this never makes the component update.
const actions = useQuantaActions(useTodos);
</script>

<template>
    <main>
        <h1 data-owner>{{ summary.owner || 'nobody' }}</h1>
        <p data-remaining>{{ summary.remaining }} left</p>
        <p v-if="loading">Loading…</p>
        <ul>
            <li v-for="todo in todos.items" :key="todo.id">
                <label>
                    <input
                        type="checkbox"
                        :checked="todo.done"
                        @change="actions.toggle(todo.id)"
                    />
                    {{ todo.text }}
                </label>
            </li>
        </ul>
        <button @click="actions.add('New todo')">Add</button>
        <button @click="actions.load('you', 500)">Reload</button>
        <!-- Each instance owns a separate store. -->
        <LocalCounter />
        <LocalCounter />
    </main>
</template>
