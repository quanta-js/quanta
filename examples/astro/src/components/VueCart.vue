<script setup lang="ts">
import { useQuantaActions, useQuantaValue } from '@quantajs/vue';
import { useCart } from '../stores';

const user = useQuantaValue(useCart, (s) => s.user);
const count = useQuantaValue(useCart, (s) => s.count);
const cart = useQuantaActions(useCart);
</script>

<template>
    <p data-island="vue">
        Vue: {{ user }} has {{ count }}
        <button @click="cart.add('from Vue')">add</button>
    </p>
</template>
