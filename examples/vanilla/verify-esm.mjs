// Smoke-tests the *built* @quantajs/core package through its ESM entry
// point (package.json "exports" -> "import"). Run after `pnpm build`, not
// against source — the point is to catch packaging bugs (wrong output
// format, a dropped export, a bundler mis-resolving `.mjs`) that unit tests
// running against `src/` never see.
import assert from 'node:assert/strict';
import * as quanta from '@quantajs/core';
import {
    defineStore,
    createContainer,
    reactive,
    computed,
    watch,
} from '@quantajs/core';

// The direct regression test for a package that quietly ships `export {}`:
// assert every documented top-level export actually exists on the module,
// not just that the ones this script happens to destructure are defined.
const expectedExports = [
    'reactive',
    'computed',
    'watch',
    'effect',
    'effectScope',
    'batchEffects',
    'defineStore',
    'createStore',
    'createContainer',
    'getDefaultContainer',
    'LocalStorageAdapter',
];
for (const name of expectedExports) {
    assert.equal(
        typeof quanta[name],
        'function',
        `@quantajs/core ESM export "${name}" is missing or not callable`,
    );
}

const useCounter = defineStore('esm-counter', {
    state: () => ({ count: 0 }),
    getters: { doubled: (s) => s.count * 2 },
    actions: {
        increment() {
            this.count++;
        },
    },
});

const container = createContainer('verify-esm');
const counter = useCounter(container);
counter.increment();
counter.increment();
assert.equal(counter.count, 2, 'action mutated state');
assert.equal(counter.doubled, 4, 'getter derived from state');

const snapshot = container.dehydrate();
assert.deepEqual(snapshot['esm-counter'], { count: 2 }, 'dehydrate() snapshot');

const client = createContainer('verify-esm-client');
client.hydrate(snapshot);
const hydrated = useCounter(client);
assert.equal(hydrated.count, 2, 'hydrate() restored state before first read');

const state = reactive({ value: 1 });
const doubledRef = computed(() => state.value * 2);
let seen;
watch(
    () => doubledRef.value,
    (v) => {
        seen = v;
    },
);
state.value = 5;
assert.equal(doubledRef.value, 10, 'computed recomputes');
assert.equal(seen, 10, 'watch fires on the recomputed value');

container.dispose();
client.dispose();

console.log('[verify-esm] @quantajs/core ESM entry point OK');
