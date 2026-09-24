<script>
    import Local from './Local.svelte';

    export let definition;
    export let onStore = undefined;
</script>

<Local {definition} {onStore} /><Local {definition} {onStore} />
