<script>
    import Local from './Local.svelte';

    let { definition, onStore } = $props();
</script>

<Local {definition} {onStore} /><Local {definition} {onStore} />
