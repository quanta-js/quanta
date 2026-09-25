<script>
    import { useLocalStore } from '../../index';

    export let definition;
    export let onStore = undefined;

    const store = useLocalStore(definition);
    onStore?.(store);
</script>

<span>{$store.a}</span>
