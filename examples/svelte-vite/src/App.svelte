<script lang="ts">
    import type { ContainerSnapshot, StoreContainer } from '@quantajs/core';
    import { setQuantaContainer } from '@quantajs/svelte';
    import Todos from './Todos.svelte';
    import LocalCounter from './LocalCounter.svelte';

    let {
        container,
        snapshot,
    }: { container?: StoreContainer; snapshot?: ContainerSnapshot } = $props();

    // The server passes the request's container; in the browser the app
    // gets its own, seeded from the server's snapshot.
    // svelte-ignore state_referenced_locally
    setQuantaContainer(container, { snapshot });
</script>

<main>
    <Todos />
    <!-- Each instance owns a separate store. -->
    <LocalCounter />
    <LocalCounter />
</main>
