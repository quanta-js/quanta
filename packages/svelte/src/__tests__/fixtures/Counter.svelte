<script>
    import { useQuanta } from '../../index';

    let { definition } = $props();
    // svelte-ignore state_referenced_locally
    const store = useQuanta(definition);
</script>

<span>{$store.a}/{$store.total}</span>
