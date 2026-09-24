<script lang="ts">
    import { useQuantaActions, useQuantaValue } from '@quantajs/svelte';
    import { useCart } from '../stores';

    const user = useQuantaValue(useCart, (s) => s.user);
    const count = useQuantaValue(useCart, (s) => s.count);
    const cart = useQuantaActions(useCart);
</script>

<p data-island="svelte">
    Svelte: {$user} has {$count}
    <button onclick={() => cart.add('from Svelte')}>add</button>
</p>
