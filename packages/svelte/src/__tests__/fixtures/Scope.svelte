<script>
    import { setQuantaContainer } from '../../index';
    import Counter from './Counter.svelte';

    let { definition, container, snapshot, onContainer } = $props();
    // svelte-ignore state_referenced_locally
    const active = setQuantaContainer(container, { snapshot });
    // svelte-ignore state_referenced_locally
    onContainer?.(active);
</script>

<Counter {definition} />
