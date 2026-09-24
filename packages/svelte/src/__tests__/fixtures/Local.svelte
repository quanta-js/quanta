<script>
    import { useLocalStore } from '../../index';

    let { definition, onStore } = $props();
    // svelte-ignore state_referenced_locally
    const store = useLocalStore(definition);
    // svelte-ignore state_referenced_locally
    onStore?.(store);
</script>

<span>{$store.a}</span>
