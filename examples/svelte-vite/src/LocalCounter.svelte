<script lang="ts">
    import { useLocalStore } from '@quantajs/svelte';
    import { useCounter } from './stores';

    const counter = useLocalStore(useCounter);
</script>

<button data-local onclick={() => $counter.inc()}>local {$counter.count}</button>
