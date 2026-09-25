<script>
    import { setQuantaContainer } from '../../index';
    import Counter from './Counter.svelte';

    export let definition;
    export let container = undefined;
    export let snapshot = undefined;
    export let onContainer = undefined;

    const active = setQuantaContainer(container, { snapshot });
    onContainer?.(active);
</script>

<Counter {definition} />
