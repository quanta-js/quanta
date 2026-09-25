<script>
    import { useQuanta } from '../../index';

    export let definition;
    const store = useQuanta(definition);
</script>

<span>{$store.a}/{$store.total}</span>
