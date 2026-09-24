<script setup lang="ts">
import { useLocalStore } from '@quantajs/vue';
import { useCounter } from './stores';

const counter = useLocalStore(useCounter);
</script>

<template>
    <button data-local @click="counter.inc()">local {{ counter.count }}</button>
</template>
